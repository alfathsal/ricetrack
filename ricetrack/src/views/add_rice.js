
const m = require('mithril')

const api = require('../services/api')
const payloads = require('../services/payloads')
const transactions = require('../services/transactions')
const parsing = require('../services/parsing')
const {MultiSelect} = require('../components/forms')
const layout = require('../components/layout')

/**
 * Possible selection options
 */
const authorizableProperties = [
  ['lokasi', 'Lokasi'],
  ['harga', 'Harga'],
]

const varietasOptions = ['Ciherang', 'Muncul', 'Mentik Wangi', 'IR42', 'Ketan'];

/**
 * The Form for tracking a new rice.
 */
const AddRice = {
  oninit (vnode) {
    /*
    // Format current date and time in a "DD-MM-YYYY" HH:mm format
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0') // Bulan dimulai dari 0
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')

    vnode.state.tgltransaksi = `${day}-${month}-${year} ${hours}:${minutes}`
    */

    // Initialize Latitude and Longitude
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        vnode.state.latitude = position.coords.latitude || ''
        vnode.state.longitude = position.coords.longitude || ''
      }, () => {
        vnode.state.latitude = ''
        vnode.state.longitude = ''
        console.error("Geolocation error or permission denied")
      })
    } else {
      console.error("Geolocation is not supported by this browser")
      vnode.state.latitude = ''
      vnode.state.longitude = ''
    }
    
    // Initialize the empty reporters fields
    vnode.state.reporters = [
      {
        reporterKey: '',
        properties: []
      }
    ]
    api.get('agents')
      .then(agents => {
        const publicKey = api.getPublicKey()
        vnode.state.agents = agents.filter(agent => agent.key !== publicKey)
      })
  },

  view (vnode) {

    return m('.rice_form',
             m('form', {
               onsubmit: (e) => {
                 e.preventDefault()
                 _handleSubmit(vnode.attrs.signingKey, vnode.state)
               }
             },
             m('legend', 'Tambahkan Beras'),
             layout.row([

             _formGroup('Nomor Seri', m('input.form-control', {
               type: 'text',
               oninput: m.withAttr('value', (value) => {
                 vnode.state.serialNumber = value
               }),
               value: vnode.state.serialNumber
             })),
             
             _formGroup('Varietas', 
              m('select.form-control', {
                onchange: m.withAttr('value', (value) => {
                  vnode.state.varietas = value;
                }),
                value: vnode.state.varietas
              }, [
                m('option', { value: '', disabled: true, selected: true }, 'Pilih Varietas'),
                varietasOptions.map((option) =>
                  m('option', { value: option }, option)
                )
              ])
            )]),

             layout.row([
               _formGroup('Berat (kg)', m('input.form-control', {
                 type: 'number',
                 step: 'any',
                 oninput: m.withAttr('value', (value) => {
                   vnode.state.berat = value
                 }),
                 value: vnode.state.berat
               })),
               _formGroup('Harga (Rp)', m('input.form-control', {
                type: 'text',
                oninput: m.withAttr('value', (value) => {
                  vnode.state.harga = formatHargaInput(value);
                }),
                value: vnode.state.harga
              }))
             ]),
             
             layout.row([
               _formGroup('Garis Lintang', m('input.form-control', {
                 type: 'number',
                 step: 'any',
                 min: -90,
                 max: 90,
                 value: vnode.state.latitude,
                 oninput: m.withAttr('value', (value) => {
                   vnode.state.latitude = value
                 }),
               })),
               _formGroup('Garis Bujur', m('input.form-control', {
                 type: 'number',
                 step: 'any',
                 min: -180,
                 max: 180,
                 value: vnode.state.longitude,
                 oninput: m.withAttr('value', (value) => {
                   vnode.state.longitude = value
                 }),
               }))
             ]),

             
             m('.row.justify-content-end.align-items-end',
               m('col-2',
                 m('button.btn.btn-primary',
                   'Tambahkan')))))
  }
}
const formatHargaInput = (value) => {
  let numericValue = value.replace(/^Rp\./, '').replace(/\./g, '')
  let formattedValue = parseInt(numericValue, 10).toLocaleString('id-ID')
  return 'Rp.' + formattedValue
};

/**
 * Update the reporter's values after a change occurs in the name of the
 * reporter at the given reporterIndex. If it is empty, and not the only
 * reporter in the list, remove it.  If it is not empty and the last item
 * in the list, add a new, empty reporter to the end of the list.
 */
const _updateReporters = (vnode, reporterIndex) => {
  let reporterInfo = vnode.state.reporters[reporterIndex]
  let lastIdx = vnode.state.reporters.length - 1
  if (!reporterInfo.reporterKey && reporterIndex !== lastIdx) {
    vnode.state.reporters.splice(reporterIndex, 1)
  } else if (reporterInfo.reporterKey && reporterIndex === lastIdx) {
    vnode.state.reporters.push({
      reporterKey: '',
      properties: []
    })
  }
}

/**
 * Handle the form submission.
 *
 * Extract the appropriate values to pass to the create record transaction.
 */
const _handleSubmit = (signingKey, state) => {
  /*
  // Mengonversi 'DD-MM-YYYY HH:mm' ke format 'YYYY-MM-DDTHH:mm'
  const parts = state.tgltransaksi.split(" ")
  const dateParts = parts[0].split("-")
  const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}`

  // Konversi string tanggal yang sudah diformat ke timestamp Tanggal Produksi
  const tgltransaksiTimestamp = new Date(formattedDate).getTime()
  // Pastikan hasilnya adalah angka yang valid
  
  if (isNaN(tgltransaksiTimestamp)) {
    alert("Format tanggal tidak valid. Gunakan format DD-MM-YYYY HH:mm")
    return
  }

  // Konversi string tanggal yang sudah diformat ke objek Date untuk menghitung Kedaluwarsa
  const tgltransaksiDate = new Date(formattedDate)
  // Pastikan hasilnya adalah tanggal yang valid
  if (isNaN(tgltransaksiDate.getTime())) {
    alert("Format tanggal produksi tidak valid. Gunakan format DD-MM-YYYY HH:mm")
    return
  }
  */

  const addTwoYears = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
  
    // Menambahkan dua tahun
    now.setFullYear(year + 2);
  
    // Mengatur jam, menit, dan detik ke 0 untuk menghindari perubahan waktu akibat pembulatan atau zona waktu
    now.setHours(0, 0, 0, 0);
  
    // Menangani kasus tahun kabisat
    if (month === 1 && day === 29) { // Februari 29
      if ((year + 2) % 4 !== 0 || ((year + 2) % 100 === 0 && (year + 2) % 400 !== 0)) {
        now.setDate(28);
      }
    }
  
    return Math.floor(now.getTime() / 1000); // Mengembalikan Unix timestamp dalam detik
  };
  
  console.log('Kedaluwarsa: ', addTwoYears())

  // Hitung tanggal kedaluwarsa (2 tahun setelah tgltransaksi)
  // const kedaluwarsaDate = new Date(tgltransaksiDate)
  // kedaluwarsaDate.setFullYear(kedaluwarsaDate.getFullYear() + 2)
  // Konversi tanggal kedaluwarsa ke timestamp atau format yang diinginkan
  // const kedaluwarsaTimestamp = kedaluwarsaDate.getTime()
  const kedaluwarsaTimestamp = addTwoYears()
  const parsedHarga = parseInt(state.harga.replace(/^Rp\./, '').replace(/\./g, ''), 10);
  const parsedBerat = state.berat ? parseInt(state.berat, 10) : 0;
  console.log('Berat: ', parsedBerat)

  const recordPayload = payloads.createRecord({
    recordId: state.serialNumber,
    recordType: 'rice',
    properties: [
      {
        name: 'varietas',
        stringValue: state.varietas,
        dataType: payloads.createRecord.enum.STRING
      },
      {
        name: 'kedaluwarsa',
        intValue: kedaluwarsaTimestamp,
        dataType: payloads.createRecord.enum.INT
      },
      {
        name: 'berat',
        intValue: parsedBerat,
        dataType: payloads.createRecord.enum.INT
      },
      {
        name: 'harga',
        intValue: parsedHarga,
        dataType: payloads.createRecord.enum.INT
      },
      {
        name: 'lokasi',
        locationValue: {
          latitude: parseInt(state.latitude * 1000000, 10),
          longitude: parseInt(state.longitude * 1000000, 10)
        },
        dataType: payloads.createRecord.enum.LOCATION
      }
    ]
  })

  const reporterPayloads = state.reporters
    .filter((reporter) => !!reporter.reporterKey)
    .map((reporter) => payloads.createProposal({
      recordId: state.serialNumber,
      receivingAgent: reporter.reporterKey,
      role: payloads.createProposal.enum.REPORTER,
      properties: reporter.properties
    }))
  
  console.log('Payload: ', recordPayload)

  transactions.submit([recordPayload].concat(reporterPayloads), true)
    .then(() => m.route.set(`/rice/${state.serialNumber}`))
}

/**
 * Create a form group (this is a styled form-group with a label).
 */
const _formGroup = (label, formEl) =>
  m('.form-group',
    m('label', label),
    formEl)

module.exports = AddRice
