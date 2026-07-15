import type { Pool, PoolConnection } from "mysql2/promise";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import { auditLogRepository, type AuditLogRepository } from "../../common/repositories/audit-log.repository.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type { RepairTicketRow } from "../repair-tickets/repair-ticket.model.js";
import { repairTicketRepository, type RepairTicketRepository } from "../repair-tickets/repair-ticket.repository.js";
import type { CreateReviewDto, UpdateReviewDto } from "./review.dto.js";
import { toReview, type Review, type ReviewRow } from "./review.model.js";
import { reviewRepository, type ReviewRepository } from "./review.repository.js";

type DatabaseExecutor = Pool | PoolConnection;
type TransactionRunner = <T>(callback: (connection: PoolConnection) => Promise<T>) => Promise<T>;
const REVIEW_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class ReviewService {
  public constructor(
    private readonly repository: ReviewRepository = reviewRepository,
    private readonly tickets: RepairTicketRepository = repairTicketRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async get(
    actor: Express.AuthenticatedUser,
    ticketId: number,
  ): Promise<Review> {
    const ticket = await this.requireTicket(pool, ticketId);
    await this.assertReadScope(actor, ticket);
    const review = await this.repository.findByTicket(pool, ticketId);
    if (!review) throw new NotFoundError("Review not found", "REVIEW_NOT_FOUND");
    return toReview(review);
  }

  public async create(
    actor: Express.AuthenticatedUser,
    ticketId: number,
    input: CreateReviewDto,
    metadata: RequestMetadata,
  ): Promise<Review> {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Only customers may create reviews", "FORBIDDEN");
    }
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const ticket = await this.requireTicket(connection, ticketId, true);
      if (ticket.customer_id !== actor.id) {
        throw new ForbiddenError("You may review only your own ticket", "TICKET_OWNER_REQUIRED");
      }
      if (ticket.status !== "DELIVERED" && ticket.status !== "CLOSED") {
        throw new ConflictError(
          "Ticket must be delivered before review",
          "TICKET_NOT_REVIEWABLE",
        );
      }
      if (await this.repository.findByTicket(connection, ticketId, true)) {
        throw new ConflictError("This ticket already has a review", "REVIEW_ALREADY_EXISTS");
      }
      const reviewId = await this.repository.create(connection, ticketId, actor.id, input);
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "REVIEW_CREATED",
        entityType: "REVIEW",
        entityId: reviewId,
        oldData: null,
        newData: { ticketId, rating: input.rating },
        ...requestMetadata,
      });
      return toReview(await this.requireReview(connection, reviewId));
    });
  }

  public async update(
    actor: Express.AuthenticatedUser,
    reviewId: number,
    input: UpdateReviewDto,
    metadata: RequestMetadata,
  ): Promise<Review> {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Only review owners may update reviews", "FORBIDDEN");
    }
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const current = await this.requireReview(connection, reviewId, true);
      if (current.customer_id !== actor.id) {
        throw new ForbiddenError("You may update only your own review", "REVIEW_OWNER_REQUIRED");
      }
      if (this.now().getTime() - current.created_at.getTime() > REVIEW_EDIT_WINDOW_MS) {
        throw new ConflictError(
          "The seven-day review edit window has expired",
          "REVIEW_EDIT_WINDOW_EXPIRED",
        );
      }
      await this.repository.update(connection, reviewId, input);
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "REVIEW_UPDATED",
        entityType: "REVIEW",
        entityId: reviewId,
        oldData: {
          rating: current.rating,
          technicianRating: current.technician_rating,
          serviceRating: current.service_rating,
          comment: current.comment,
        },
        newData: input,
        ...requestMetadata,
      });
      return toReview(await this.requireReview(connection, reviewId));
    });
  }

  private async assertReadScope(
    actor: Express.AuthenticatedUser,
    ticket: RepairTicketRow,
  ): Promise<void> {
    if (actor.role === "MANAGER" || actor.role === "RECEPTIONIST") return;
    if (actor.role === "CUSTOMER" && actor.id === ticket.customer_id) return;
    if (
      actor.role === "TECHNICIAN" &&
      await this.tickets.hasActiveAssignment(pool, ticket.id, actor.id)
    ) return;
    throw new ForbiddenError("You are not allowed to view this review", "REVIEW_ACCESS_DENIED");
  }

  private async requireTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<RepairTicketRow> {
    const ticket = await this.tickets.findById(executor, ticketId, lockForUpdate);
    if (!ticket) throw new NotFoundError("Repair ticket not found", "REPAIR_TICKET_NOT_FOUND");
    return ticket;
  }

  private async requireReview(
    executor: DatabaseExecutor,
    reviewId: number,
    lockForUpdate = false,
  ): Promise<ReviewRow> {
    const review = await this.repository.findById(executor, reviewId, lockForUpdate);
    if (!review) throw new NotFoundError("Review not found", "REVIEW_NOT_FOUND");
    return review;
  }
}

export const reviewService = new ReviewService();

