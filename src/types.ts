export type IssueCategory = 
  | "Traffic" 
  | "Road" 
  | "Emergency" 
  | "Safety" 
  | "Sanitation" 
  | "Water" 
  | "Electricity" 
  | "Environment" 
  | "Infrastructure" 
  | "Public Health" 
  | "Other";
export type IssueStatus = "Pending" | "Verified" | "In Progress" | "Resolved" | "Rejected";
export type UserRole = "admin" | "user";

export interface IssueComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: string;
}

export interface IssueReport {
  id: string;
  reporterUid: string;
  category: IssueCategory;
  description?: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark?: string;
  status: IssueStatus;
  isFake: boolean;
  aiReasoning?: string;
  aiConfidence?: number;
  rejectionReason?: string;
  upvotes: string[]; // Array of user UIDs
  comments: IssueComment[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'status_change' | 'comment' | 'system' | 'broadcast';
  issueId?: string;
  read: boolean;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  trustScore: number;
  photoURL?: string;
  bio?: string;
  location?: string;
  joinedAt: string;
}

export interface IssueUpdate {
  status?: IssueStatus;
  updatedAt: string;
  rejectionReason?: string;
}

export interface AnalyticsData {
  byStatus: { status: IssueStatus; count: number }[];
  byCategory: { category: IssueCategory; count: number }[];
  byDay: { date: string; count: number }[];
  total: number;
  fakeCount: number;
  verifiedCount: number;
  resolvedCount: number;
  pendingCount: number;
}
