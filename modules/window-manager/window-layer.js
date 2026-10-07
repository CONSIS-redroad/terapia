export class WindowLayer {
  constructor(start = 100) { this.current = start; }
  next() { return ++this.current; }
}
