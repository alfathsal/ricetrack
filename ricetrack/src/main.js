/**
 * Copyright 2017 Intel Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ----------------------------------------------------------------------------
 */
'use strict'

// These requires inform webpack which styles to build
require('bootstrap')
require('../styles/main.scss')

const m = require('mithril')

const api = require('./services/api')
const transactions = require('./services/transactions')
const navigation = require('./components/navigation')

const AddRice = require('./views/add_rice')
const AgentDetailPage = require('./views/agent_detail')
const AgentList = require('./views/list_agents')
const RiceList = require('./views/list_rice')
const RiceDetail = require('./views/rice_detail')
const Dashboard = require('./views/dashboard')
const LoginForm = require('./views/login_form')
const PropertyDetailPage = require('./views/property_detail')
const SignupForm = require('./views/signup_form')

/**
 * A basic layout component that adds the navbar to the view.
 */
const Layout = {
  view (vnode) {
    return [
      vnode.attrs.navbar,
      m('.content.container', vnode.children)
    ]
  }
}

const loggedInNav = () => {
  const links = [
    ['/create', 'Tambahkan Beras'],
    ['/rice', 'Beras'],
    ['/agents', 'Administrator']
  ]
  return m(navigation.Navbar, {}, [
    navigation.links(links),
    navigation.link('/profile', 'Profil'),
    navigation.button('/logout', 'Keluar')
  ])
}

const loggedOutNav = () => {
  const links = [
    ['/rice', 'Beras'],
    ['/agents', 'Distributor']
  ]
  return m(navigation.Navbar, {}, [
    navigation.links(links),
    navigation.button('/login', 'Masuk')
  ])
}

/**
 * Returns a route resolver which handles authorization related business.
 */
const resolve = (view, restricted = false) => {
  const resolver = {}

  if (restricted) {
    resolver.onmatch = () => {
      if (api.getAuth()) return view
      m.route.set('/login')
    }
  }

  resolver.render = vnode => {
    if (api.getAuth()) {
      return m(Layout, { navbar: loggedInNav() }, m(view, vnode.attrs))
    }
    return m(Layout, { navbar: loggedOutNav() }, m(view, vnode.attrs))
  }

  return resolver
}

/**
 * Clears user info from memory/storage and redirects.
 */
const logout = () => {
  api.clearAuth()
  transactions.clearPrivateKey()
  m.route.set('/')
}

/**
 * Redirects to user's agent page if logged in.
 */
const profile = () => {
  const publicKey = api.getPublicKey()
  if (publicKey) m.route.set(`/agents/${publicKey}`)
  else m.route.set('/')
}

/**
 * Build and mount app/router
 */
document.addEventListener('DOMContentLoaded', () => {
  m.route(document.querySelector('#app'), '/', {
    '/': resolve(Dashboard),
    '/agents/:publicKey': resolve(AgentDetailPage),
    '/agents': resolve(AgentList),
    '/create': resolve(AddRice, true),
    '/rice/:recordId': resolve(RiceDetail),
    '/rice': resolve(RiceList),
    '/login': resolve(LoginForm),
    '/logout': { onmatch: logout },
    '/profile': { onmatch: profile },
    '/properties/:recordId/:name': resolve(PropertyDetailPage),
    '/signup': resolve(SignupForm)
  })
})

document.addEventListener('DOMContentLoaded', (event) => {
  fetchCurrentPosition();
});
