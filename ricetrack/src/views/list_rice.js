'use strict'

const m = require('mithril')
const truncate = require('lodash/truncate')
const { Table, FilterGroup, PagingButtons } = require('../components/tables')
const api = require('../services/api')
const { formatTimestamp } = require('../services/parsing')
const { getPropertyValue, getLatestPropertyUpdateTime, getOldestPropertyUpdateTime, countUniqueUpdates } = require('../utils/records')

const PAGE_SIZE = 50

const RiceList = {
  oninit(vnode) {
    vnode.state.records = []
    vnode.state.filteredRecords = []
    vnode.state.currentPage = 0
    vnode.state.currentFilter = (record) => true;

    const refresh = () => {
      api.get('records?recordType=rice').then((records) => {
        vnode.state.records = records
        vnode.state.records.sort((a, b) => {
          return getLatestPropertyUpdateTime(b) - getLatestPropertyUpdateTime(a)
        })
        vnode.state.filteredRecords = vnode.state.records.filter(vnode.state.currentFilter); // Modified line
      })
        .then(() => { vnode.state.refreshId = setTimeout(refresh, 2000) })
    }

    refresh()
  },

  onbeforeremove(vnode) {
    clearTimeout(vnode.state.refreshId)
  },

  view(vnode) {
    let publicKey = api.getPublicKey()

    return [
      m('.rice-table',
        m('.row.btn-row.mb-2', _controlButtons(vnode, publicKey)),
        m('table', [
          m('thead',
            m('tr', [
              m('th', 'Nomor Seri'),
              m('th', 'Varietas'),
              m('th', 'Dibuat'),
              m('th', 'Diubah'),
              m('th', 'Perubahan')
            ])
          ),
          m('tbody',
            vnode.state.filteredRecords.slice(
              vnode.state.currentPage * PAGE_SIZE,
              (vnode.state.currentPage + 1) * PAGE_SIZE
            ).map((rec) =>
              m('tr', [
                m('td', m(`a[href=/rice/${rec.recordId}]`, { oncreate: m.route.link }, truncate(rec.recordId, { length: 32 }))),
                m('td', getPropertyValue(rec, 'packaging_date')),
                m('td', formatTimestamp(getOldestPropertyUpdateTime(rec))),
                m('td', formatTimestamp(getLatestPropertyUpdateTime(rec))),
                m('td', m(`a[href=/rice-updates/${rec.recordId}]`, { oncreate: m.route.link }, countUniqueUpdates(rec).toString()))
              ])
            )
          )
        ])
      )
    ]
  }
}

const _controlButtons = (vnode, publicKey) => {
  let filterRecords = (f) => {
    vnode.state.currentFilter = f; // Modified line
    vnode.state.filteredRecords = vnode.state.records.filter(f)
  }

  if (publicKey) {
    return [
      m('.col-sm-8',
        m(FilterGroup, {
          ariaLabel: 'Filter Based on Ownership',
          filters: {
            'Semua': () => {
              vnode.state.currentFilter = (record) => true; // Modified line
              vnode.state.filteredRecords = vnode.state.records
            },
            'Dimiliki': () => filterRecords((record) => record.owner === publicKey),
          //  'Custodian': () => filterRecords((record) => record.custodian === publicKey),
            'Dilaporkan': () => filterRecords(
              (record) => record.properties.reduce(
                (owned, prop) => owned || prop.reporters.indexOf(publicKey) > -1, false))
          },
          initialFilter: 'Semua'
        })),
      m('.col-sm-4', _pagingButtons(vnode))
    ]
  } else {
    return [
      m('.col-sm-4.ml-auto', _pagingButtons(vnode))
    ]
  }
}

const _pagingButtons = (vnode) =>
  m(PagingButtons, {
    setPage: (page) => { vnode.state.currentPage = page },
    currentPage: vnode.state.currentPage,
    maxPage: Math.floor(vnode.state.filteredRecords.length / PAGE_SIZE)
  })

module.exports = RiceList
