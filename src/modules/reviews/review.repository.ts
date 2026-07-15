import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import type { CreateReviewDto, UpdateReviewDto } from "./review.dto.js";
import type { ReviewRow } from "./review.model.js";

type DatabaseExecutor = Pool | PoolConnection;
type SqlValue = string | number | null;

const reviewColumns = `
  r.id,
  r.ticket_id,
  rt.ticket_code,
  rt.status AS ticket_status,
  r.customer_id,
  customer.full_name AS customer_name,
  r.rating,
  r.technician_rating,
  r.service_rating,
  r.comment,
  r.created_at,
  r.updated_at
`;

const reviewJoins = `
  INNER JOIN repair_tickets AS rt ON rt.id = r.ticket_id
  INNER JOIN users AS customer ON customer.id = r.customer_id
`;

export class ReviewRepository {
  public async findByTicket(
    executor: DatabaseExecutor,
    ticketId: number,
    lockForUpdate = false,
  ): Promise<ReviewRow | null> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<ReviewRow[]>(
      `
        SELECT ${reviewColumns}
        FROM reviews AS r
        ${reviewJoins}
        WHERE r.ticket_id = ?
        LIMIT 1
        ${lock}
      `,
      [ticketId],
    );
    return rows[0] ?? null;
  }

  public async findById(
    executor: DatabaseExecutor,
    reviewId: number,
    lockForUpdate = false,
  ): Promise<ReviewRow | null> {
    const lock = lockForUpdate ? "FOR UPDATE" : "";
    const [rows] = await executor.execute<ReviewRow[]>(
      `
        SELECT ${reviewColumns}
        FROM reviews AS r
        ${reviewJoins}
        WHERE r.id = ?
        LIMIT 1
        ${lock}
      `,
      [reviewId],
    );
    return rows[0] ?? null;
  }

  public async create(
    connection: PoolConnection,
    ticketId: number,
    customerId: number,
    input: CreateReviewDto,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO reviews (
          ticket_id, customer_id, rating, technician_rating,
          service_rating, comment
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        ticketId,
        customerId,
        input.rating,
        input.technicianRating ?? null,
        input.serviceRating ?? null,
        input.comment ?? null,
      ],
    );
    return result.insertId;
  }

  public async update(
    connection: PoolConnection,
    reviewId: number,
    input: UpdateReviewDto,
  ): Promise<void> {
    const columns: Record<keyof UpdateReviewDto, string> = {
      rating: "rating",
      technicianRating: "technician_rating",
      serviceRating: "service_rating",
      comment: "comment",
    };
    const assignments: string[] = [];
    const params: SqlValue[] = [];
    for (const field of Object.keys(columns) as Array<keyof UpdateReviewDto>) {
      if (input[field] !== undefined) {
        assignments.push(`${columns[field]} = ?`);
        params.push(input[field] ?? null);
      }
    }
    await connection.execute<ResultSetHeader>(
      `UPDATE reviews SET ${assignments.join(", ")} WHERE id = ?`,
      [...params, reviewId],
    );
  }
}

export const reviewRepository = new ReviewRepository();

