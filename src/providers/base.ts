export interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  url: string;
  source: 'github' | 'gitlab';
}
