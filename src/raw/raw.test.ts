import { describe, it } from 'mocha';
import * as assert from 'assert';
import { Stream } from 'xstream';
import { default as build, RawSettings, RawLoadInstruction } from './';
import { mockTimeSource, MockTimeSource } from '@cycle/time';
import { ResizeEvent } from 'cycle-resize';

const timeSource: MockTimeSource = mockTimeSource({ interval: 20 });
const getRawLoadInstruction = build(timeSource);

describe('Test of getRawLoadInstruction$()', function() {
  it('should be able to work without scroll or resize streams, nor settings', function() {
    assert.doesNotThrow(function() {
      getRawLoadInstruction({});
    });
  });

  it('should accept a stream of scroll events and a stream of resize events as input', function() {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    assert.doesNotThrow(function() {
      getRawLoadInstruction({ scroll$, resize$ });
    });
  });

  it('should accept a stream of settings as optional input', function() {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = Stream.of({ contentHeight: 40 });
    assert.doesNotThrow(function() {
      getRawLoadInstruction({ scroll$, resize$ }, settings$);
    });
  });

  it('should return an empty stream of LoadInstruction when provided with empty streams as sources', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }), Stream.never());
    timeSource.run(done);
  });

  it("should return loading instructions according to user's scroll (no settings)", function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('--a--b--c--d--------', {
      a: {
        deltaY: -10
      },
      b: {
        deltaY: 10
      },
      c: {
        deltaX: 10
      },
      d: {
        deltaZ: 10
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('-----a--------------', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }), expected$);
    timeSource.run(done);
  });

  it("should return loading instructions according to user's resize actions (no settings)", function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = timeSource.diagram('--a--b--c-----------', {
      a: {
        deltaX: 0,
        deltaY: 50
      },
      b: {
        deltaX: 0,
        deltaY: -50
      },
      c: {
        deltaX: 50,
        deltaY: 0
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('--a-----------------', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }), expected$);
    timeSource.run(done);
  });

  it("should return loading instructions according to content's height setting", function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('a---a----------', {
      a: {
        deltaY: 110
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('--o------------', {
      o: {
        contentHeight: 25
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('a---b----------', {
      a: {},
      b: {
        quantity: 5
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should handle an invalid contentHeight setting by applying default setting', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('--a------------', {
      a: {
        deltaY: 110
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('o--------------', {
      o: {
        contentHeight: -25
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('--a------------', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it("should return loading instructions according to content's height and buffer settings", function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('--aa--aa--aa---', {
      a: {
        deltaY: 25
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('i---j---k------', {
      i: {
        contentHeight: 25,
        buffer: 50
      },
      j: {
        contentHeight: 25,
        buffer: 150
      },
      k: {
        contentHeight: 25,
        buffer: 100
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('-abb-cbb--bb---', {
      a: {
        quantity: 2
      },
      b: {
        quantity: 1
      },
      c: {
        quantity: 4
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should ignore buffer setting if contentHeight is not provided', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('ab-------------', {
      a: {
        buffer: 75
      },
      b: {
        buffer: 100
      }
    });
    const expected$: Stream<RawLoadInstruction> = Stream.never();
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should handle an invalid buffer setting by applying default setting', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('abc------------', {
      a: {
        contentHeight: 25,
        buffer: 0
      },
      b: {
        contentHeight: 25,
        buffer: -100
      },
      c: {
        contentHeight: 25,
        buffer: 50
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('---a-----------', {
      a: {
        quantity: 2
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should debounce scroll according to settings', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('x----y---------', {
      x: {
        contentHeight: 50
      },
      y: {
        contentHeight: 50,
        debounce: 20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('-aaaa-----b----', {
      a: {
        quantity: 1
      },
      b: {
        quantity: 4
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should debounce resize according to settings', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaY: 50
      }
    });
    const settings$: Stream<RawSettings> = timeSource.diagram('x----y---------', {
      x: {
        contentHeight: 50
      },
      y: {
        contentHeight: 50,
        debounce: 20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('-aaaa-----b----', {
      a: {
        quantity: 1
      },
      b: {
        quantity: 4
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should handle an invalid debounce setting by applying default setting', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('-----o---------', {
      o: {
        debounce: -20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('aaaaa-aaaa-----', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should throttle scroll according to settings', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('-----o---------', {
      o: {
        throttle: 20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('aaaaa-a-a------', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should throttle resize according to settings', function(done) {
    const scroll$: Stream<WheelEvent> = Stream.never();
    const resize$: Stream<ResizeEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaX: 0,
        deltaY: 50
      }
    });
    const settings$: Stream<RawSettings> = timeSource.diagram('-----o---------', {
      o: {
        throttle: 20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('aaaaa-a-a------', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should handle an invalid throttle setting by applying default setting', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('aaaaaaaaaa-----', {
      a: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('-----o---------', {
      o: {
        throttle: -20
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('aaaaa-aaaa-----', {
      a: {}
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });

  it('should accumulate settings', function(done) {
    const scroll$: Stream<WheelEvent> = timeSource.diagram('aaaaaaaaaaaaaaa', {
      a: {
        deltaY: 50
      }
    });
    const resize$: Stream<ResizeEvent> = Stream.never();
    const settings$: Stream<RawSettings> = timeSource.diagram('a----b---------', {
      a: {
        contentHeight: 25
      },
      b: {
        throttle: 200
      }
    });
    const expected$: Stream<RawLoadInstruction> = timeSource.diagram('-aaaa-a--------', {
      a: {
        quantity: 2
      }
    });
    timeSource.assertEqual(getRawLoadInstruction({ scroll$, resize$ }, settings$), expected$);
    timeSource.run(done);
  });
});
