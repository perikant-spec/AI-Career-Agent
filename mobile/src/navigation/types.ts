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
  JobsTab: undefined;
  ApplicationsTab: undefined;
  NetworkingTab: undefined;
  InterviewsTab: undefined;
  Settings: undefined;
};
