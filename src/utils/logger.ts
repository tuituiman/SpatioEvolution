export const logger = {
  log: import.meta.env.DEV ? console.log.bind(console) : () => {},
  warn: import.meta.env.DEV ? console.warn.bind(console) : () => {},
  error: console.error.bind(console),
}
