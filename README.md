# cycle-lazy-load

A lazy-loading library for infinite scrolling in [Cycle.js](https://github.com/cyclejs/cyclejs). It reacts to the following user actions:

- when the user scrolls down, more content shall be loaded;
- when the user resizes the window up to a greater height, more content shall be loaded.

## Index

- [Demo](#demo)
- [Usage](#usage)
- [API](#api)
  - [getRawLoadInstruction](#getrawloadinstruction)
  - [getChainedLoadInstruction](#getchainedloadinstruction)
  - [Typings (simplified)](#typings-simplified)
- [Settings](#settings)
  - [contentHeight](#contentheight)
  - [buffer](#buffer)
  - [minQuantity](#minquantity)
  - [maxQuantity](#maxquantity)
  - [debounce](#debounce)
  - [throttle](#throttle)
- [Implementation note](#implementation-note)

## Demo

[`cycle-lazy-load-demo`](https://github.com/mathieueveillard/cycle-lazy-load-demo) demonstrates in detail how to use this library and integrate it with a back-end.

![Demo gif](./doc/demo.gif)

## Usage

```
npm i cycle-lazy-load --save
```

If you're willing to react to the events of the user resizing the window, you'll need a resize driver: [`cycle-resize`](https://www.npmjs.com/package/cycle-resize).

The following assumes a back-end API with support of pagination, eg. [ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-search-after.html).

```JavaScript
import { run } from '@cycle/run';
import { makeDOMDriver, div } from '@cycle/dom';
import { makeHTTPDriver } from '@cycle/http';
import { makeResizeDriver } from 'cycle-resize';
import { timeDriver } from '@cycle/time';
import xs from 'xstream';
import build from 'cycle-lazy-load';

const SETTINGS = {
  contentHeight: 70,
  buffer: 4000
};

const drivers = {
  dom: makeDOMDriver('#app'),
  resize: makeResizeDriver(),
  http: makeHTTPDriver(),
  time: timeDriver
};

function main({ dom, resize, http, time }) {
  const { getChainedLoadInstruction } = build(time);
  const scroll$ = dom.select('.list').events('wheel');
  const resize$ = resize.resize$;
  const list$ = getModel(http);
  const settings$ = xs.of(SETTINGS);
  const loadInstruction$ = getChainedLoadInstruction({ scroll$, resize$ }, list$, settings$);
  const request$ = getRequest(loadInstruction$);
  const view$ = getView(list$);
  return {
    dom: view$,
    http: request$
  };
}

run(main, drivers);

function getModel(http) {
  return http
    .select('search')
    .flatten()
    .map(response => response.body)
    .fold((acc, cur) => [...acc, ...cur], []);
}

function getView(list$) {
  return list$.map(list => div('.list', list.map(makeDataView)));
}

function makeDataView({ sort, body }) {
  // This is up to you
  return div('.data--container', [div('.data--sort', `Sort: [${sort}]`), div('.data--body', body)]);
}

function getRequest(loadInstruction$) {
  return loadInstruction$.map(({ quantity, after }) => ({
    category: 'search',
    url: 'http://path/to/api/data/_search',
    method: 'POST',
    type: 'json',
    accept: 'json',
    send: {
      size: quantity,
      search_after: after
    }
  }));
}
```

## API

The library allows you to work at two different levels of abstraction.

### `getRawLoadInstruction()`

This is the lowest level of service provided by the library.

With no `contentHeight` provided, `getRawLoadInstruction()` will return a stream of empty `RawLoadInstruction` objects telling the application that it should fetch more content from back-end due to user actions (scroll or resize). How much items is up to you, but it already has value.

Example with no `contentHeight` setting:

```text
scroll (in px):                 --10---20-5-----------------------------------
getChainedLoadInstruction():    --x----x--x-----------------------------------
```

Of course, it's much more interesting if `contentHeight` is provided, because `getRawLoadInstruction()` will return a stream of `RawLoadInstruction` objects with an indication of the quantity of items to fetch depending on how much the user has scrolled or resized the window.

Example with `contentHeight = 10px`:

```text
scroll (in px):                 --10---20-5-----------------------------------
getChainedLoadInstruction():    --1----2--1-----------------------------------
```

### `getChainedLoadInstruction()`

This is the highest level of abstraction. It uses `getRawLoadInstruction()`. The following assumes an API endpoint with support of pagination (eg. [ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-search-after.html)).

That's where things become really interesting: by providing a `Content` stream, one basically provides a feedback loop to `getChainedLoadInstruction()`. Indeed, `Content.sort` corresponds to the rank given by the application's back-end to the items loaded within the list of all results matching the request (possibly tens or hundreds of thousands). `cycle-lazy-load` uses this attribute to compute the `ChainedLoadInstruction.after` attribute, which can be used as the `search_after` parameter when requesting the back-end.

Features:

- Waits for the last request to succeed before emitting a new `ChainedLoadInstruction`. Meanwhile, it accumulates the quantities of items to load as per user actions. Example:

```text
getRawLoadInstruction():        --15--------15-----15---15--15----15----------
XHR success:                    ------x------------------------x-----x----x---
getChainedLoadInstruction():    --15--------15-----------------45----15-------
```

- If the user makes a lot of actions and you feel concerned with the workload of your back-end, you may want to trigger requests only if a given minimal amount of items to load has been accumulated. Example with `minQuantity = 20`:

```text
getRawLoadInstruction():        --5---5-5--5----5-5---5-----5-----------------
XHR success:                    ------------------x------------x--------------
getChainedLoadInstruction():    -----------20---------------20----------------
```

- If a large number of items must be fetched and `maxQuantity` limits the number of items that can be loaded per request, it automatically chunks this quantity in slices of `maxQuantity` items and gradually emits the `ChainedLoadInstruction`s as each slice is retrieved from the back-end. Example with `maxQuantity = 50`:

```text
getRawLoadInstruction():        --30-----30-----190---------------------------
XHR success:                    -----x-----x---------x---x------x--x----------
getChainedLoadInstruction():    --30-----30-----50---50--50-----40------------
```

Let's wrap it up with a more complex example, assuming `minQuantity = 20` and `maxQuantity = 50`:

```text
getRawLoadInstruction():        --15--15--15--15--15--15----------15----------
XHR success:                    --------------------------x---x--------x------
getChainedLoadInstruction():    ------30------------------50------25----------
                                  (1) (2) (3) (3) (3) (3) (4) (5) (6)
```

- (1) Not enough quantity has been accumulated (15 < 20), no request is triggered.
- (2) Enough quantity has been accumulated (15 + 15 = 30, 30 > 20), a request for 30 items is triggered.
- (3) Nothing can be done until the first request has returned. Meanwhile, quantities accumulate up to 15 + 15 + 15 + 15 = 60.
- (4) The first request has returned, a new request can be triggered. However, it will be caped to 50. 60 - 50 = 10 must wait for their turn.
- (5) The second request has returned, a new request can be triggered. However, not enough quantity has been accumulated (10 < 20), no request is triggered.
- (6) Enough quantity has been accumulated (10 + 15 = 25, 25 > 20), a request for 25 items is triggered.

### Typings (simplified)

```TypeScript
import { Stream } from 'xstream';
import { TimeSource } from '@cycle/time';
import { ResizeEvent } from 'cycle-resize';

export interface Events {
  scroll$?: Stream<WheelEvent>;
  resize$?: Stream<ResizeEvent>;
}

export interface RawSettings {
  contentHeight?: number;
  buffer?: number;
  debounce?: number;
  throttle?: number;
}

export interface RawLoadInstruction {
  quantity?: number;
}

export interface Settings {
  contentHeight: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface Content {
  sort: any[];
}

export interface ChainedLoadInstruction {
  quantity: number;
  after: any[];
}

export default function build(timeSource: TimeSource): {
  getRawLoadInstruction: ({ scroll$, resize$ }: Events, settings$?: Stream<RawSettings>) => Stream<RawLoadInstruction>;
  getChainedLoadInstruction: (events: Events, content$: Stream<Content[]>, settings$: Stream<Settings>) => Stream<ChainedLoadInstruction>;
};
```

## Settings

### `contentHeight`

- A height, in pixels
- An estimation of the content's height, including vertical margin (if any). The lower the value, the more conservative (safe) you are.
- For `getRawLoadInstruction()`: optional
- For `getChainedLoadInstruction()`: required
- Default value: N/A

### `buffer`

- A height, in pixels
- In addition to the content displayed on screen, the buffer represents some content that has to be loaded before appearing on screen, so that the user doesn't wait for the content to load when he scrolls. Future requests will regenerate this buffer.
- For `getRawLoadInstruction()`: optional
- For `getChainedLoadInstruction()`: optional
- Default value: 0px

### `minQuantity`

- Without unit
- The minimum quantity to accumulate before triggering a request.
- For `getRawLoadInstruction()`: N/A
- For `getChainedLoadInstruction()`: optional
- Default value: none

### `maxQuantity`

- Without unit
- The maximum quantity that can be requested in one time.
- For `getRawLoadInstruction()`: N/A
- For `getChainedLoadInstruction()`: optional
- Default value: none

### `debounce`

- A period of time, in milliseconds
- An event will be ignored if another event occurs during the debounce period after the first one has occured, and the former one will be delayed of this period of time. This is the regular definition of debounce: see [`debounce()`](https://github.com/staltz/xstream/blob/master/EXTRA_DOCS.md#debounce). However, here the events accumulate meantime. See [`xstream-debounce-accumulate`](https://github.com/mathieueveillard/xstream-debounce-accumulate).
- For `getRawLoadInstruction()`: optional
- For `getChainedLoadInstruction()`: optional
- **Warning**: if the user scrolls continuously, even low values of `debounce` (eg. 30ms) will delay next requests until the user stops scrolling. This can be misleading.
- Default value: 0ms

### `throttle`

- A period of time, in milliseconds
- Refractory period after an event occurs. During this period, every event will be ignored. See [`throttle()`](https://github.com/staltz/xstream/blob/master/EXTRA_DOCS.md#throttle).
- For `getRawLoadInstruction()`: optional
- For `getChainedLoadInstruction()`: optional
- Default value: 0ms

## Implementation note

One might ask: "why `settings$` rather than `settings`?"

Indeed, most settings will probably be set once for all. This is especially true for `debounce` and `throttle`. However, further improvements of this library could lead to changing values of the other settings:

- `contentHeight`: this value could be re-computed each time new content is received, for better accuracy;

- `buffer`, `minQuantity` and `maxQuantity` could be adapted to network conditions (eg: the lower the bandwidth, the greater the `buffer` should be).

In an attempt to facilitate such improvements, decision has been made to natively work with streams of settings rather than settings.
