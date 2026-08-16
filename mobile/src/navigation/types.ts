import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
};

export type ApplicationsStackParamList = {
  ApplicationsList: undefined;
  ApplicationDetail: { applicationId: string };
};

export type NetworkingStackParamList = {
  ContactsList: undefined;
  ContactDetail: { contactId: string };
};

export type InterviewsStackParamList = {
  InterviewsList: undefined;
  InterviewDetail: { applicationId: string };
};

export type MainTabParamList = {
  Home: undefined;
  JobsTab: NavigatorScreenParams<JobsStackParamList>;
  ApplicationsTab: NavigatorScreenParams<ApplicationsStackParamList>;
  NetworkingTab: NavigatorScreenParams<NetworkingStackParamList>;
  InterviewsTab: NavigatorScreenParams<InterviewsStackParamList>;
  Settings: undefined;
};
