export interface Repo {
  owner: string;
  repo: string;
}

export interface Job {
  title: string;
  repo: string;
  url: string;
  labels: string[];
  postedAt: string;
}

export interface JobsByDate {
  [date: string]: Job[];
}
