import Vue from 'vue'
import Router from 'vue-router'
import Tracer from '@/components/Tracer'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Tracer',
      component: Tracer
    }
  ]
})
