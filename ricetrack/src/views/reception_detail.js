const m = require("mithril");
const api = require("../services/api");
const payloads = require("../services/payloads");
const { getPropertyValue } = require("../utils/records");
const {
  formatDateTime,
  formatDate,
  formatTimestamp,
  formatCurrency,
  formatLocation,
} = require("./formatUtils");
const { _answerProposal, ROLE_TO_ENUM } = require("./proposalUtils");
const { _agentByKey, _finalizeRecord } = require("./recordUtils");
const { show, BasicModal } = require("../components/modals");

const ReceptionDetail = {
  oninit: async (vnode) => {
    vnode.state.riceRecord = null;
    vnode.state.processingRecord = null;
    vnode.state.receptionRecord = null;
    vnode.state.deliveryRecord = null;
    vnode.state.harvestRecord = null;
    vnode.state.plantingRecord = null;
    vnode.state.fieldRecord = null;
    vnode.state.farmer = null;
    vnode.state.aggregator = null;

    vnode.state.agents = [];
    vnode.state.owner = null;

    try {
      await _loadData(vnode.attrs.recordId, vnode.state);
      vnode.state.refreshId = setInterval(() => {
        _loadData(vnode.attrs.recordId, vnode.state);
      }, 60000);

      vnode.state.receptionRecord = vnode.state.record;
      console.log("receptionRecord: ", vnode.state.receptionRecord);
      
      const receptionId = vnode.state.receptionRecord.recordId;
      const processingRecord = await api.get("records?recordType=processing");
      vnode.state.processingRecord = processingRecord.filter(
        (record) => receptionId === getPropertyValue(record, "reception_id")
      );
      console.log("processingRecord: ", vnode.state.processingRecord);

      const processingId = vnode.state.processingRecord.recordId;
      const riceRecord = await api.get("records?recordType=rice");
      vnode.state.riceRecord = riceRecord.filter(
        (record) => processingId === getPropertyValue(record, "processing_id")
      );
      console.log("Rice Records: ", vnode.state.riceRecord);

      const deliveryId = vnode.state.receptionRecord.properties.find(
        (prop) => prop.name === "delivery_id"
      ).value;
      vnode.state.deliveryRecord = await api.get(`records/${deliveryId}`);
      console.log("deliveryRecord: ", vnode.state.deliveryRecord);

      const harvestId = vnode.state.deliveryRecord.properties.find(
        (prop) => prop.name === "harvest_id"
      ).value;
      vnode.state.harvestRecord = await api.get(`records/${harvestId}`);
      console.log("harvestRecord: ", vnode.state.harvestRecord);

      const plantingId = vnode.state.harvestRecord.properties.find(
        (prop) => prop.name === "planting_id"
      ).value;
      vnode.state.plantingRecord = await api.get(`records/${plantingId}`);
      console.log("plantingRecord: ", vnode.state.plantingRecord);

      const fieldId = vnode.state.plantingRecord.properties.find(
        (prop) => prop.name === "field_id"
      ).value;
      vnode.state.fieldRecord = await api.get(`records/${fieldId}`);
      console.log("fieldRecord: ", vnode.state.fieldRecord);

      // Update the view once all data is fetched
      m.redraw();
    } catch (error) {
      console.error(error);
    }
  },

  onbeforeremove(vnode) {
    clearInterval(vnode.state.refreshId);
  },

  view(vnode) {
    if (
      !vnode.state.receptionRecord ||
      !vnode.state.deliveryRecord ||
      !vnode.state.harvestRecord ||
      !vnode.state.plantingRecord ||
      !vnode.state.fieldRecord
    ) {
      return m(".alert-warning", `Loading ${vnode.attrs.recordId}`);
    }
    vnode.state.farmer = vnode.state.agents.find(
      (agent) => agent.key === vnode.state.plantingRecord.owner
    );
    vnode.state.aggregator = vnode.state.agents.find(
      (agent) => agent.key === vnode.state.deliveryRecord.owner
    );
    const record = vnode.state.record;
    const publicKey = api.getPublicKey();
    const isOwner = record.owner === publicKey;

    return m(
      ".reception-detail",
      m("h3.text-center", record.recordId),
      _displayRecordProperties(record),
      _displayRecordDetails(
        record,
        vnode.state.fieldRecord,
        vnode.state.plantingRecord,
        vnode.state.harvestRecord,
        vnode.state.deliveryRecord,
        vnode.state.receptionRecord,
        vnode.state.riceRecord,
        vnode.state.owner,
        vnode.state.farmer,
        vnode.state.aggregator
      ),
      _displayInteractionButtons(record, publicKey, isOwner, vnode)
    );
  },
};

const _displayRecordDetails = (
  record,
  fieldRecord,
  plantingRecord,
  harvestRecord,
  deliveryRecord,
  receptionRecord,
  riceRecord,
  owner,
  farmer,
  aggregator
) => {
  console.log("Owner ", owner);
  return [
    _row(
      _labelProperty(
        "Kode Penerimaan",
        getPropertyValue(record, "reception_id"),
        _labelProperty(
          "Tanggal Penggilingan",
          formatTimestamp(getPropertyValue(record, "processing_date"))
        )
      )
    ),
    _row(
      _labelProperty(
        "Pabrik Penggiling",
        getPropertyValue(receptionRecord, "rmu_id")
      ),
      _labelProperty(
        "Harga Beli ke Pengumpul (per kg)",
        formatCurrency(getPropertyValue(receptionRecord, "price"))
      )
    ),
    _row(
      _labelProperty("Nama Pengumpul", _agentLink(aggregator)),
      _labelProperty(
        "Harga Beli ke Petani(per kg)",
        formatCurrency(getPropertyValue(deliveryRecord, "total_price"))
      )
    ),
    _row(
      _labelProperty("Nama Petani", _agentLink(farmer)),
      _labelProperty(
        "Lokasi Sawah",
        _recordLink(fieldRecord, getPropertyValue(fieldRecord, "address"))
      )
    ),
    _row(
      _labelProperty(
        "Tanggal Panen",
        formatTimestamp(getPropertyValue(harvestRecord, "harvest_date"))
      ),
      _labelProperty(
        "Harga Jual ke Pengumpul (per kg)",
        formatCurrency(getPropertyValue(harvestRecord, "sale_price"))
      )
    ),
  ];
};

const _displayRecordProperties = (record) => {
  return record.properties.map((prop) => {
    let valueDisplay; // Initialize without a default value
    console.log("Prop : ", prop);
    console.log("Prop name", prop.name);
    console.log("Prop type ", prop.type);
    console.log("Prop val: ", getPropertyValue(record, prop.name));
/*
    const translations = {
      "delivery_id": "Kode Pengiriman",
      "processing_date": "Tanggal Penggilingan",
      "husking": "Pecah Kulit",
      "whitening": "Whitening",
      "polishing": "Poles",
      "packaging": "Kemasan",
      "production": "Hasil Produksi",
    };
*/
    // Adjusting to use prop.type for dataType, and prop.type values are in uppercase
    switch (prop.type) {
      case "STRING":
        valueDisplay = getPropertyValue(record, prop.name);
        break;
      case "INT":
        valueDisplay = getPropertyValue(record, prop.name).toString();
        break;
      case "FLOAT":
        valueDisplay = getPropertyValue(record, prop.name).toString();
        break;
      case "DATE":
        valueDisplay = formatTimestamp(getPropertyValue(record, prop.name));
        break;
      case "LOCATION":
        // Assuming formatLocation is adequately designed to format the location object
        valueDisplay = formatLocation(getPropertyValue(record, prop.name));
        break;
      default:
        valueDisplay = "Data type not recognized";
    }
    console.log("valueDisplay: ", valueDisplay);

    return m(".col-md-6", m("dl", 
    m("dt", prop.name),
    m("dd", valueDisplay)
  ))
  });
};

const _displayInteractionButtons = (record, publicKey, isOwner, vnode) => {
  return m(
    ".row.m-2",
    m(".col.text-center", [
      // isCustodian && m('button.btn.btn-primary', { onclick: () => m.route.set(`/update-properties/${record.recordId}`) }, 'Update Properties'),
      m(
        "button.btn.btn-primary",
        { onclick: () => m.route.set(`/rice-updates/${record.recordId}`) },
        "Lacak"
      ),
      isOwner &&
        !record.final &&
        m(
          "button.btn.btn-primary",
          {
            onclick: () =>
              m.route.set(`/transfer-ownership/${record.recordId}`),
          },
          "Jual"
        ),
      // isCustodian && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/transfer-custodian/${record.recordId}`) }, 'Ubah Kustodian'),
      isOwner &&
        !record.final &&
        m(
          "button.btn.btn-primary",
          {
            onclick: () => m.route.set(`/manage-reporters/${record.recordId}`),
          },
          "Kelola Reporter"
        ),
      // isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => _finalizeWithConfirmation(vnode) }, 'Finalisasi')
    ])
  );
};

// Fungsi untuk menampilkan konfirmasi finalisasi
function _finalizeWithConfirmation(vnode) {
  show(BasicModal, {
    title: "Konfirmasi Finalisasi",
    body: "Apakah Anda yakin ingin menyelesaikan record ini? Tindakan ini tidak dapat dibatalkan.",
    acceptText: "Ya",
    cancelText: "Tidak",
  })
    .then(() => {
      // Use the record from the current vnode state
      _finalizeRecord(vnode.state.record)
        .then(() => {
          alert("Record successfully finalized");
          // Reload the data to reflect changes
          _loadData(vnode.attrs.recordId, vnode.state);
        })
        .catch((err) => {
          console.error("Error finalizing record:", err);
          const errorMessage = err.response
            ? err.response.data.error
            : err.message;
          alert(`Error finalizing record: ${errorMessage}`);
        });
    })
    .catch(() => {
      console.log("Finalization cancelled");
    });
}

const _row = (...cols) =>
  m(
    ".row",
    cols.map((col) => m(".col", col))
  );
const _labelProperty = (label, value) => [
  m("dl", m("dt", label), m("dd", value)),
];
const _agentLink = (agent) => {
  console.log("Agent: ", agent);
  console.log("Agent name: ", agent.name);
  return m(
    `a[href=/agents/${agent.key}]`,
    { oncreate: m.route.link },
    agent.name
  );
};

const _propLink = (record, propName, content) =>
  m(
    `a[href=/properties/${record.recordId}/${propName}]`,
    { oncreate: m.route.link },
    content
  );
const _recordLink = (record, content) =>
  m(`a[href=/fields/${record.recordId}]`, { oncreate: m.route.link }, content);

const _loadData = (recordId, state) => {
  return api.get(`records/${recordId}`).then((record) => {
    return api.get("agents").then((agents) => {
      state.record = record;
      state.agents = agents;
      state.owner = agents.find((agent) => agent.key === record.owner);
    });
  });
};

module.exports = ReceptionDetail;
