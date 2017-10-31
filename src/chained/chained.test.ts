import { describe, it } from 'mocha';
import * as assert from 'assert';
import { Stream } from 'xstream';
import { default as build, Content, Settings, ChainedLoadInstruction } from './';
import { ResizeEvent } from 'cycle-resize';
import { mockTimeSource, MockTimeSource } from '@cycle/time';

const timeSource: MockTimeSource = mockTimeSource({ interval: 20 });
const getChainedLoadInstruction = build(timeSource);

describe('Test of getChainedLoadInstruction()', function() {
  it('should accept events, a content stream and a stream of settings as input', function() {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings: Stream<Settings> = Stream.never();
    assert.doesNotThrow(function() {
      getChainedLoadInstruction({ scroll$, resize$ }, content$, settings);
    });
  });

  it('should throw an error when no contentHeight is provided', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {}
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'contentHeight must be defined')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when a contentHeight is provided other than a number', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 'contentHeight'
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'contentHeight must be a number')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when zero or a negative contentHeight is provided', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 0
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'contentHeight must be greater than 0')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when minQuantity is not a number', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 50,
        minQuantity: 'minQuantity'
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'minQuantity must be a number')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when minQuantity is negative', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 50,
        minQuantity: -1
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'minQuantity must be greater than or equal to 0')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when maxQuantity is not a number', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 50,
        maxQuantity: 'maxQuantity'
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'maxQuantity must be a number')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when maxQuantity is lesser than 1', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 50,
        maxQuantity: 0
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'maxQuantity must be greater than or equal to 1')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should throw an error when minQuantity > maxQuantity', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('a---------------', {
      a: {
        contentHeight: 50,
        minQuantity: 10,
        maxQuantity: 5
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('#---------------');
    const actual$: Stream<ChainedLoadInstruction> = getChainedLoadInstruction(
      { scroll$, resize$ },
      content$,
      settings$
    );
    actual$.subscribe({
      error: error => assert.equal(error, 'minQuantity must be lesser than or equal to maxQuantity')
    });
    timeSource.assertEqual(actual$, expected$);
    timeSource.run(done);
  });

  it('should return load instructions according to scroll or resize events', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('-a----b-c-------', {
      a: {
        deltaY: 200
      },
      b: {
        deltaY: 150
      },
      c: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = timeSource.diagram('---a--------b--c', {
      a: [{ sort: [5.35] }, { sort: [5.0] }, { sort: [4.81] }, { sort: [4.8] }],
      b: [{ sort: [4.22] }, { sort: [4.17] }, { sort: [3.55] }],
      c: [{ sort: [3.0] }]
    });
    const settings$: Stream<Settings> = timeSource.diagram('o---------------', {
      o: {
        contentHeight: 50
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('-a----b-----c---', {
      a: {
        quantity: 4,
        after: []
      },
      b: {
        quantity: 3,
        after: [4.8]
      },
      c: {
        quantity: 1,
        after: [3.55]
      }
    });
    timeSource.assertEqual(getChainedLoadInstruction({ scroll$, resize$ }, content$, settings$), expected$);
    timeSource.run(done);
  });

  it('should retain load instructions while min quantity is not reached', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('-aaaaaaaaaaaaaaaaa', {
      a: {
        deltaY: 20
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = timeSource.diagram('-------a-----b------', {
      a: [{ sort: [0] }, { sort: [1] }, { sort: [2] }, { sort: [3] }, { sort: [4] }],
      b: [{ sort: [5] }, { sort: [6] }, { sort: [7] }, { sort: [8] }, { sort: [9] }]
    });
    const settings$: Stream<Settings> = timeSource.diagram('o---------------', {
      o: {
        contentHeight: 20,
        minQuantity: 5
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('-----a----b----c----', {
      a: {
        quantity: 5,
        after: []
      },
      b: {
        quantity: 5,
        after: [4]
      },
      c: {
        quantity: 5,
        after: [9]
      }
    });
    timeSource.assertEqual(getChainedLoadInstruction({ scroll$, resize$ }, content$, settings$), expected$);
    timeSource.run(done);
  });

  it("should return a batch of load instructions when all the content can't be loaded in one time (maxQuantity option)", function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('-a----------------', {
      a: {
        deltaY: 1100
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = timeSource.diagram('--a--b--c---------', {
      a: [
        { sort: [1100] },
        { sort: [1050] },
        { sort: [1000] },
        { sort: [950] },
        { sort: [900] },
        { sort: [850] },
        { sort: [800] },
        { sort: [750] },
        { sort: [700] },
        { sort: [650] }
      ],
      b: [
        { sort: [600] },
        { sort: [550] },
        { sort: [500] },
        { sort: [450] },
        { sort: [400] },
        { sort: [350] },
        { sort: [300] },
        { sort: [250] },
        { sort: [200] },
        { sort: [150] }
      ],
      c: [{ sort: [100] }, { sort: [50] }]
    });
    const settings$: Stream<Settings> = timeSource.diagram('o---------------', {
      o: {
        contentHeight: 50,
        maxQuantity: 10
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('-ab--c--------------', {
      a: {
        quantity: 10,
        after: []
      },
      b: {
        quantity: 10,
        after: [650]
      },
      c: {
        quantity: 2,
        after: [150]
      }
    });
    timeSource.assertEqual(getChainedLoadInstruction({ scroll$, resize$ }, content$, settings$), expected$);
    timeSource.run(done);
  });

  it('should adapt to a change of settings', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('-a----------------', {
      a: {
        deltaY: 1100
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = timeSource.diagram('---a-b------------', {
      a: [
        { sort: [1100] },
        { sort: [1050] },
        { sort: [1000] },
        { sort: [950] },
        { sort: [900] },
        { sort: [850] },
        { sort: [800] },
        { sort: [750] },
        { sort: [700] },
        { sort: [650] }
      ],
      b: [
        { sort: [600] },
        { sort: [550] },
        { sort: [500] },
        { sort: [450] },
        { sort: [400] },
        { sort: [350] },
        { sort: [300] },
        { sort: [250] },
        { sort: [200] },
        { sort: [150] },
        { sort: [100] },
        { sort: [50] }
      ]
    });
    const settings$: Stream<Settings> = timeSource.diagram('o-p-------------', {
      o: {
        contentHeight: 50,
        maxQuantity: 10
      },
      p: {
        contentHeight: 50
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('-a-b----------------', {
      a: {
        quantity: 10,
        after: []
      },
      b: {
        quantity: 12,
        after: [650]
      }
    });
    timeSource.assertEqual(getChainedLoadInstruction({ scroll$, resize$ }, content$, settings$), expected$);
    timeSource.run(done);
  });

  it('should return an initial instruction according to buffer setting', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const content$: Stream<Content[]> = Stream.never();
    const settings$: Stream<Settings> = timeSource.diagram('o---------------', {
      o: {
        contentHeight: 50,
        buffer: 1000
      }
    });
    const expected$: Stream<ChainedLoadInstruction> = timeSource.diagram('-a------------------', {
      a: {
        quantity: 20,
        after: []
      }
    });
    timeSource.assertEqual(getChainedLoadInstruction({ scroll$, resize$ }, content$, settings$), expected$);
    timeSource.run(done);
  });
});
