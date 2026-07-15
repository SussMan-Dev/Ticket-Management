import { useState } from "react";
import { Button } from "../../components/ui/button";
import { EmptyState, ErrorState, LoadingState, MutationError } from "../../components/ui/data-state";
import { FormField } from "../../components/ui/form-field";
import { formatDateTime } from "../../lib/formatting/formatters";
import type { RepairTicket, Review, UserRole } from "../../types/domain";
import { useCreateReview, useReview, useUpdateReview, type ReviewInput } from "./reviews.api";

const initialReview: ReviewInput = { rating: 5, technicianRating: 5, serviceRating: 5, comment: "" };

export function ReviewPanel({ ticket, role }: { ticket: RepairTicket; role: UserRole }) {
  const reviewable = ["DELIVERED", "CLOSED"].includes(ticket.status);
  const review = useReview(ticket.id, reviewable);
  const create = useCreateReview(ticket.id);
  const update = useUpdateReview(ticket.id, review.data?.id ?? 0);
  const [editing, setEditing] = useState(false);
  const [viewedAt] = useState(() => Date.now());
  const canEdit = role === "CUSTOMER" && (!review.data || viewedAt - new Date(review.data.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1_000);
  const save = async (values: ReviewInput) => {
    const payload = { ...values, comment: values.comment?.trim() || null };
    if (review.data) await update.mutateAsync(payload); else await create.mutateAsync(payload);
    setEditing(false);
  };

  if (!reviewable) return <section><h2>Đánh giá dịch vụ</h2><EmptyState title="Chưa thể đánh giá" description="Khách hàng có thể đánh giá sau khi thiết bị được bàn giao." /></section>;
  if (review.isLoading) return <LoadingState rows={2} />;
  if (review.isError) return <ErrorState error={review.error} retry={() => void review.refetch()} />;
  const showForm = role === "CUSTOMER" && (!review.data || editing);
  return <section aria-labelledby="review-title"><div className="section-heading"><div><h2 id="review-title">Đánh giá dịch vụ</h2><p>Mỗi phiếu có một đánh giá; khách hàng được chỉnh sửa trong 7 ngày.</p></div>{review.data && canEdit && !editing ? <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Chỉnh sửa</Button> : null}</div>{showForm ? <ReviewForm key={review.data?.updatedAt ?? "new"} review={review.data ?? null} pending={create.isPending || update.isPending} onSave={save} onCancel={editing ? () => setEditing(false) : undefined} /> : review.data ? <div className="review-summary"><strong className="review-score">{review.data.rating}<small>/5</small></strong><div><p>{review.data.comment ?? "Khách hàng không để lại nhận xét."}</p><small>Kỹ thuật viên {review.data.technicianRating ?? "—"}/5 · Dịch vụ {review.data.serviceRating ?? "—"}/5 · {formatDateTime(review.data.updatedAt)}</small></div></div> : <EmptyState title="Chưa có đánh giá" description={role === "CUSTOMER" ? "Hãy chia sẻ trải nghiệm của bạn." : "Khách hàng chưa gửi đánh giá cho phiếu này."} />}<MutationError error={create.error ?? update.error} /></section>;
}

function ReviewForm({ review, pending, onSave, onCancel }: { review: Review | null; pending: boolean; onSave(values: ReviewInput): Promise<void>; onCancel?: () => void }) {
  const [values, setValues] = useState<ReviewInput>(review ? { rating: review.rating, technicianRating: review.technicianRating, serviceRating: review.serviceRating, comment: review.comment ?? "" } : initialReview);
  const setRating = (field: "rating" | "technicianRating" | "serviceRating", value: string) => setValues((current) => ({ ...current, [field]: Number(value) }));
  return <div className="form-grid form-grid--three"><RatingField label="Tổng thể" id="rating" value={values.rating} onChange={(value) => setRating("rating", value)} /><RatingField label="Kỹ thuật viên" id="technician-rating" value={values.technicianRating ?? 5} onChange={(value) => setRating("technicianRating", value)} /><RatingField label="Dịch vụ" id="service-rating" value={values.serviceRating ?? 5} onChange={(value) => setRating("serviceRating", value)} /><div className="span-three"><FormField label="Nhận xét" htmlFor="review-comment"><textarea id="review-comment" rows={3} maxLength={2000} value={values.comment ?? ""} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} /></FormField></div><div className="span-three button-row"><Button loading={pending} onClick={() => void onSave(values)}>{review ? "Lưu đánh giá" : "Gửi đánh giá"}</Button>{onCancel ? <Button variant="ghost" onClick={onCancel}>Hủy</Button> : null}</div></div>;
}

function RatingField({ label, id, value, onChange }: { label: string; id: string; value: number; onChange(value: string): void }) {
  return <FormField label={label} htmlFor={id}><select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></FormField>;
}
