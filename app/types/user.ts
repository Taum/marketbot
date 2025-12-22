export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface UserWithDates extends User {
  createdAt: Date;
  updatedAt: Date;
}
