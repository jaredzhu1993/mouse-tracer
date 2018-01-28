<template>
  <canvas
    id="container"
    ref="container"
    v-bind:width="fullWidth"
    v-bind:height="fullHeight"
  >
    mouse tracer amination
  </canvas>
</template>

<script>
import Rx from 'rxjs/Rx';

export default {
  name: 'Tracer',
  data () {
    return {
      fullHeight: 0,
      fullWidth: 0,
    }
  },
  mounted: function () {
    const container = this.$refs.container;
    const ctx = container.getContext('2d');
    //初始化canvas大小
    this.handleResize();
    //随窗口大小变化，改变canvas的大小
    const resize = Rx.Observable.fromEvent(window, 'resize');
    this.resizeSubscription = resize.subscribe({
      next: this.handleResize,
    })
    //鼠标移动
    const mouseMove = Rx.Observable.fromEvent(container, 'mousemove')
      .map(({clientX, clientY}) => state => {
        return Object.assign(
          {},
          state,
          {
            mousePosition: {
              x: clientX,
              y: clientY,
            },
          },
        );
      })
    //鼠标按下
    const mouseDown = Rx.Observable.fromEvent(container, 'mousedown')
      .map(({clientX, clientY}) => state => Object.assign(
        {},
        state,
        {
          down: true,
        }
      ))
    //鼠标抬起
    const mouseUp = Rx.Observable.fromEvent(container, 'mouseup')
      .map(() => state => Object.assign(
        {},
        state,
        {
          down: false,
        }
      ))
    //鼠标出去
    const mouseOut = Rx.Observable.fromEvent(container, 'mouseout')
      .map(() => state => Object.assign(
        {},
        state,
        {
          down: false,
        }
      ))
    //每32毫秒向staticPoints增加静态点
    const staticPointer = Rx.Observable.interval(32)
      .map(() => state => {
        const {mousePosition,staticPoints,} = state;
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
      })
    //每隔16毫秒，增加动态点
    const dynamicPointer = Rx.Observable.interval(16)
      .map(() => state => {
        const { mousePosition, lastPosition, down, dynamicPoints, } = state;
        let resultState = Object.assign(
          {},
          state,
          {
            lastPosition: mousePosition,
          }
        );
        if(down) {
          //鼠标没有移动，增加星形点
          if(mousePosition === lastPosition) {
            resultState = Object.assign(
              {},
              resultState,
              {
                dynamicPoints: [
                  ...dynamicPoints,
                  ...mapDynamicPointer(
                    mousePosition.x,
                    mousePosition.y
                  )
                ],
              }
            )
          } else {
            //鼠标移动，增加圆锥效果
            const direction = {
              x: lastPosition.x - mousePosition.x,
              y: lastPosition.y - mousePosition.y,
            }
            resultState = Object.assign(
              {},
              resultState,
              {
                dynamicPoints: [
                  ...dynamicPoints,
                  ...mapDynamicPointer(
                    mousePosition.x,
                    mousePosition.y,
                    pointDirectionTodirections(direction)
                  ),
                ]
              }
            )
          }
        }
        return resultState;
      })
    //每隔16毫秒，点的状态发生改变
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
        down: false,  //鼠标是否按下
        mousePosition: {
          x: 0,
          y: 0,
        }, //鼠标的位置
        lastPosition: {
          x: 0,
          y: 0,
        },  //鼠标上一次的位置
        staticPoints: [],  //静态点
        dynamicPoints: [],  //动态点
      }
    );

    this.tracerSubscription = tracerState.subscribe(({ staticPoints, dynamicPoints, }) => {
      //清空canvas，重新画点
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

//星形方向
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
//圆锥方向
function pointDirectionTodirections({
  x,
  y
}) {
  //鼠标速度太快或者太慢，都不会有圆锥角效果
  const mouseSpeed = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  if (mouseSpeed > 25 || mouseSpeed < 6) return void(0);
  //除数不能为0
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
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  #container {
    cursor: none;
  }
</style>