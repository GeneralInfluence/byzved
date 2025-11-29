declare module 'pg' {
  export interface QueryResult {
    rows: any[];
    command: string;
    rowCount: number;
  }

  export interface ClientConfig {
    connectionString?: string;
  }

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query(sql: string): Promise<QueryResult>;
    end(): Promise<void>;
  }
}
