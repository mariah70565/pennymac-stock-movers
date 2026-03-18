export interface Mover {
    date: string;
    ticker: string;
    percentChange: number;
    closePrice: number;
}

export interface ApiResponse {
    movers: Mover[];
    nextPageToken?: string;
}