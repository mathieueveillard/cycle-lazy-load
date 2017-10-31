import { Stream, Subscription, Listener } from 'xstream';

export const fakeListener: Listener<any> = {
  next() {},
  error() {},
  complete() {}
};

export function startStream($: Stream<any>): Subscription {
  return $.subscribe(fakeListener);
}
