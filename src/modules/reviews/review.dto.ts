export interface CreateReviewDto {
  rating: number;
  technicianRating?: number | null;
  serviceRating?: number | null;
  comment?: string | null;
}

export interface UpdateReviewDto {
  rating?: number;
  technicianRating?: number | null;
  serviceRating?: number | null;
  comment?: string | null;
}

