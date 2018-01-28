<template>
  <canvas
    id="container"
    v-bind:width="fullWidth"
    v-bind:height="fullHeight"
  >
    mouse tracer amination
  </canvas>
</template>

<script>
import Rx from 'rxjs/Rx';

//星星角
const dxyArray = [
  [-2, 0],
  [-1.732, 1],
  [-1, 1.732],
  [0, 2],
  [1, 1.732],
  [1.732, 1],
  [2, 0],
  [1.732, -1],
  [1, -1.732],
  [0, -2],
  [-1, -1.732],
  [-1.732, -1]
];
let currentH = 0;

function getColor() {
  currentH += 1;
  return {
      h: currentH % 360,
      s: '50%',
      l: '50%',
      alpha: 0.3,
  }
}
//圆锥角
function pointDirectionTodirections({
  x,
  y
}) {
  if (Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) > 25 || Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) < 6) return void(0);
  // if (Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) > 25) return void(0);
  if (x === 0) {
    x += 0.001;
  }
  const normalizedX = x / Math.abs(x);
  //symbol控制圆锥的方向
  const symbol = x / Math.abs(x);
  const normalizedY = y / Math.abs(x);
  const length = 2;
  const tan = normalizedY / normalizedX;
  const alpha = Math.atan(tan);
  const result = [];
  for (let i = -Math.PI / 4; i <= Math.PI / 4; i += Math.PI / 8) {
    result.push([
      length * Math.cos(alpha + i) * symbol,
      length * Math.sin(alpha + i) * symbol
    ]);
  }
  return result;
}

function mapDynamicPointer(x1, y1, directions = dxyArray) {
  const color = getColor();
  return directions.map(([x, y]) => (
    Object.assign({}, {
      x: x1,
      y: y1,
      dx: x,
      dy: y,
      radius: 5,
    }, color)
  ));
}

function mapStaticPointer(x1, y1) {
  return Object.assign({}, {
    x: x1,
    y: y1,
    radius: 5,
  }, getColor());
}

export default {
  name: 'Tracer',
  data () {
    return {
      fullHeight: document.documentElement.clientHeight,
      fullWidth: document.documentElement.clientWidth,
    }
  },
  mounted: function () {
    const container = document.getElementById('container');
    const ctx = container.getContext('2d');

    const resize = Rx.Observable.fromEvent(window, 'resize');
    this.resizeSubscription = resize.subscribe({
      next: this.handleResize,
    })

    const mouseMove = Rx.Observable.fromEvent(container, 'mousemove')
      .map(({clientX, clientY}) => state => {
        const {mousePosition, down, dynamicPoints,} = state;
        let direction;
        let result = Object.assign(
          {},
          state,
          {
            mousePosition: {
              x: clientX,
              y: clientY,
            },
          },
        );
        if(mousePosition) {
          direction = {
            x: mousePosition.x - clientX,
            y: mousePosition.y - clientY,
          }
        }
        if(down) {
          result = Object.assign(
            {},
            result,
            {
              dynamicPoints: [
                ...dynamicPoints,
                ...mapDynamicPointer(
                  clientX,
                  clientY,
                  pointDirectionTodirections(direction)
                ),
              ]
            }
          )
        }
        return result;
      })

    const mouseDown = Rx.Observable.fromEvent(container, 'mousedown')
      .map(({clientX, clientY}) => state => Object.assign(
        {},
        state,
        {
          down: true,
          dynamicPoints: [
            ...state.dynamicPoints,
            ...mapDynamicPointer(
              clientX,
              clientY,
            ),
          ]
        }
      ))

    const mouseUp = Rx.Observable.fromEvent(container, 'mouseup')
      .map(() => state => Object.assign(
        {},
        state,
        {
          down: false,
        }
      ))

    const mouseOut = Rx.Observable.fromEvent(container, 'mouseout')
      .map(() => state => Object.assign(
        {},
        state,
        {
          down: false,
        }
      ))

    const staticPointer = Rx.Observable.interval(32)
      .map(() => state => {
        const {mousePosition,staticPoints,} = state;
        if(mousePosition) {
          return Object.assign(
            {},
            state,
            {
              staticPoints: [
                ...staticPoints,
                mapStaticPointer(mousePosition.x, mousePosition.y)
              ],
            }
          )
        }
        return state;
      })

    const dynamicPointer = Rx.Observable.interval(16)
      .map(() => state => {
        const {mousePosition,lastPosition,down,dynamicPoints} = state;
        if(mousePosition === lastPosition && down) {
          return Object.assign(
            {},
            state,
            {
              lastPosition: mousePosition,
              dynamicPoints: [
                ...dynamicPoints,
                ...mapDynamicPointer(mousePosition.x, mousePosition.y)
              ],
            }
          )
        }
        return Object.assign(
          {},
          state,
          {
            lastPosition: mousePosition,
          }
        )
      })

    const pointerChange = Rx.Observable.interval(16)
      .map(() => state => {
        const { staticPoints, dynamicPoints, } = state;
        return Object.assign(
          {},
          state,
          {
            staticPoints: staticPoints
              .map((pointer) => ({
                ...pointer,
                radius: pointer.radius - .05,
                alpha: pointer.alpha - 0.005,
              }))
              .filter((pointer) => (
                pointer.radius >= 1
              )),
            dynamicPoints: dynamicPoints
              .map((pointer) => ({
                ...pointer,
                radius: pointer.radius - .05,
                alpha: pointer.alpha + 0.005,
                x: pointer.x + pointer.dx,
                y: pointer.y + pointer.dy,
              }))
              .filter((pointer) => (
                pointer.radius >= 1
              )),
          }
        )
      })

    const tracerState = Rx.Observable.merge(
      mouseMove,
      mouseDown,
      mouseUp,
      mouseOut,
      staticPointer,
      dynamicPointer,
      pointerChange
    ).scan(
      (state, changeFn) => changeFn(state),
      {
        down: false,
        mousePosition: undefined,
        lastPosition: undefined,
        staticPoints: [],
        dynamicPoints: [],
      }
    );

    this.tracerSubscription = tracerState.subscribe(({ staticPoints, dynamicPoints, }) => {
      ctx.clearRect(0, 0, this.fullWidth, this.fullHeight);
      [...staticPoints, ...dynamicPoints].forEach((pointer) => {
        const {
            x,
            y,
            h,
            s,
            l,
            alpha,
            radius
        } = pointer;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `hsla(${[h, s, l, alpha].join(',')})`;
        ctx.fill();
      })
    })

  },
  beforeDestroy: function () {
    this.resizeSubscription.unsubscribe();
    this.tracerSubscription.unsubscribe();
  },
  methods: {
    handleResize (event) {
      const w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0];
      this.fullHeight = w.innerHeight || e.clientHeight || g.clientHeight;
      this.fullWidth = w.innerWidth || e.clientWidth || g.clientWidth
    },
  },
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  #container {
    cursor: none;
  }
</style>