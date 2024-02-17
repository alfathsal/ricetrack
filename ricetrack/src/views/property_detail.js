
'use strict'

const m = require('mithril')
const _ = require('lodash')

const api = require('../services/api')
const payloads = require('../services/payloads')
const parsing = require('../services/parsing')
const transactions = require('../services/transactions')
const layout = require('../components/layout')
const { LineGraphWidget, MapWidget } = require('../components/data')
const { Table, PagingButtons } = require('../components/tables')

const PAGE_SIZE = 50

const withIntVal = fn => m.withAttr('value', v => fn(parsing.toInt(v)))

const _formGroup = (label, formEl) =>
  m('.form-group',
    m('label', label),
    formEl)

const typedWidget = state => {
  const property = _.get(state, 'property', {})

  if (property.dataType === 'LOCATION') {
    return m(MapWidget, {
      coordinates: property.updates.map(update => update.value)
    })
  }

  if (property.dataType === 'INT' || property.dataType === 'FLOAT') {
    return m(LineGraphWidget, { updates: property.updates })
  }
/*
  if (property.name === 'shock') {
    return m(LineGraphWidget, {
      updates: property.updates.map(update => {
        const degree = update.value.duration === 0
          ? 0
          : update.value.accel / update.value.duration
        return _.assign({}, update, {value: degree.toFixed(3)})
      })
    })
  }
*/
  return null
}

const updateSubmitter = state => e => {
  e.preventDefault();
  const { name, dataType, recordId } = state.property;

  let value = null;
  if (state.update) {
    value = state.update;
  } else if (name === 'harga') {
    value = parseInt(state.tmp.harga.replace(/^Rp\./, '').replace(/\./g, ''), 10);
  } else if (dataType === 'LOCATION') {
    // Convert latitude and longitude to millionths for LOCATION dataType
    value = {
      latitude: parseInt(state.tmp.latitude * 1000000, 10),
      longitude: parseInt(state.tmp.longitude * 1000000, 10)
    };
  } else {
    value = state.tmp;
  }

  const update = { name };
  update.dataType = payloads.updateProperties.enum[dataType];
  update[`${dataType.toLowerCase()}Value`] = value;

  const payload = payloads.updateProperties({
    recordId,
    properties: [update]
  });

  transactions.submit(payload, true)
    .then(() => api.get(`records/${recordId}/${name}`))
    .then(property => {
      _.each(e.target.elements, el => { el.value = null; })
      state.update = null;
      state.tmp = {};
      property.updates.forEach(update => {
        update.value = parsing.floatifyValue(update.value);
      });
      state.property = property;
    });
};

// Produces custom input fields for location, harga, and shock
const typedInput = state => {
  const { dataType, name } = state.property

  if (dataType === 'LOCATION') {
    
    return [
      layout.row([
        _formGroup('Garis Lintang', m('input.form-control', {
          type: 'number',
          step: 'any',
          min: -90,
          max: 90,
          value: state.tmp.latitude,
          oninput: m.withAttr('value', (value) => {
            state.tmp.latitude = value
          }),
        })),
        _formGroup('Garis Bujur', m('input.form-control', {
          type: 'number',
          step: 'any',
          min: -180,
          max: 180,
          value: state.tmp.longitude,
          oninput: m.withAttr('value', (value) => {
            state.tmp.longitude = value
          }),
        }))
      ]),
    ]
  }

  if (name === 'harga') {
    return m('.col.md-8',
      m('input.form-control', {
        placeholder: 'Rp.0',
        oninput: m.withAttr('value', value => {
          // Format the input to include "Rp." and thousand separators
          state.tmp.harga = formatCurrencyInput(value);
        }),
        value: state.tmp.harga
      }))
  }
  const formatCurrencyInput = (value) => {
    let numericValue = value.replace(/^Rp\./, '').replace(/\./g, '');
    let formattedValue = parseInt(numericValue, 10).toLocaleString('id-ID');
    return 'Rp.' + formattedValue;
  };
/*
  if (name === 'shock') {
    return [
      m('.col.md-4.mr-1',
        m('input.form-control', {
          placeholder: 'Enter Acceleration...',
          oninput: withIntVal(value => { state.tmp.accel = value })
        })),
      m('.col.md-4',
        m('input.form-control', {
          placeholder: 'Enter Duration...',
          oninput: withIntVal(value => { state.tmp.duration = value })
        }))
    ]
  }
*/
  if (name === 'kedaluwarsa') {
    return m('.col-md-8', [
      m('input.form-control', {
        placeholder: 'Enter Temperature...',
        oninput: withIntVal(value => { state.update = value })
      })
    ])
  }

  return null
}

const updateForm = state => {
  const inputField = typedInput(state)
  if (!inputField) return null

  return m('form.my-5', {
    onsubmit: updateSubmitter(state)
  }, [
    m('.container',
      m('.row.justify-content-center',
        inputField,
        m('.col-md-2',
          m('button.btn.btn-primary', { type: 'submit' }, 'Update'))))
  ])
}

/**
 * Displays updates to a property, and form for submitting new updates.
 */
const PropertyDetailPage = {
  oninit (vnode) {
    vnode.state.currentPage = 0
    vnode.state.tmp = {}

    // Method to get current location
    const getCurrentLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          vnode.state.tmp.latitude = position.coords.latitude;
          vnode.state.tmp.longitude = position.coords.longitude;
          m.redraw();
        }, (error) => {
          console.error('Error getting location:', error);
          vnode.state.tmp.latitude = '';
          vnode.state.tmp.longitude = '';
        });
      } else {
        console.error('Geolocation is not supported by this browser.');
      }
    };

    // Get the current location
    getCurrentLocation();

    const refresh = () => {
      api.get(`records/${vnode.attrs.recordId}/${vnode.attrs.name}`)
        .then(property => {
          property.updates.forEach(update => {
            update.value = parsing.floatifyValue(update.value)
          })
          vnode.state.property = property
        })
        .then(() => { vnode.state.refreshId = setTimeout(refresh, 2000) })
    }

    refresh()
  },

  onbeforeremove (vnode) {
    clearTimeout(vnode.state.refreshId)
  },

  view (vnode) {
    const name = _.capitalize(vnode.attrs.name)
    const record = vnode.attrs.recordId

    const reporters = _.get(vnode.state, 'property.reporters', [])
    const isReporter = reporters.includes(api.getPublicKey())

    const updates = _.get(vnode.state, 'property.updates', [])
    const page = updates.slice(vnode.state.currentPage * PAGE_SIZE,
                               (vnode.state.currentPage + 1) * PAGE_SIZE)

    return [
      layout.title(`${name} of ${record}`),
      typedWidget(vnode.state),
      isReporter ? updateForm(vnode.state) : null,
      m('.container',
        layout.row([
          m('h5.mr-auto', 'Update History'),
          m(PagingButtons, {
            setPage: page => { vnode.state.currentPage = page },
            currentPage: vnode.state.currentPage,
            maxPage: updates.length / PAGE_SIZE
          })
        ]),
        m(Table, {
          headers: ['Value', 'Reporter', 'Time'],
          rows: page.map(update => {
            return [
              parsing.stringifyValue(update.value,
                                     vnode.state.property.dataType,
                                     vnode.state.property.name),
              update.reporter.name,
              parsing.formatTimestamp(update.timestamp)
            ]
          }),
          noRowsText: 'This property has never been updated'
        }))
    ]
  }
}

module.exports = PropertyDetailPage
