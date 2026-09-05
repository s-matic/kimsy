export interface AiImageInput {
  data: string;
  mediaType: string;
  filename: string;
}

export interface AiSourceInput {
  text: string;
  images: AiImageInput[];
}
