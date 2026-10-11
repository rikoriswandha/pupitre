/** Jobs integration used by asynchronous actions and exports. */
export interface JobsAdapter {
  dispatch(job: string, payload: Record<string, unknown>): Promise<void>
  register(job: string, handler: (payload: Record<string, unknown>) => Promise<void>): void
  initialize?(): Promise<void>
}
