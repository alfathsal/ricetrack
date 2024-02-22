const m = require("mithril");
const api = require("../services/api");
const { getPropertyValue } = require("../utils/records");
const {
  formatDateTime,
  formatDate,
  formatTimestamp,
  formatCurrency,
  formatLocation,
} = require("./formatUtils");
const { _agentByKey, _finalizeRecord } = require("./recordUtils");
const { show, BasicModal } = require("../components/modals");

const FieldDetail = {
  oninit: async (vnode) => {
    vnode.state.riceRecords = null;
    vnode.state.processingRecords = null;
    vnode.state.receptionRecords = null;
    vnode.state.deliveryRecords = null;
    vnode.state.harvestRecords = null;
    vnode.state.plantingRecords = null;
    vnode.state.fieldRecord = null;

    vnode.state.agents = [];
    vnode.state.owner = null;

    try {
      await _loadData(vnode.attrs.recordId, vnode.state);
      vnode.state.refreshId = setInterval(() => {
        _loadData(vnode.attrs.recordId, vnode.state);
      }, 60000);
      vnode.state.fieldRecord = vnode.state.record;
      console.log("fieldRecord: ", vnode.state.fieldRecord);

      await api.get("records?recordType=planting").then(async (records) => {
        const plantingRecords = records.filter(
          (record) =>
            getPropertyValue(record, "field_id") === vnode.attrs.recordId
        );
        vnode.state.plantingRecords = plantingRecords;

        console.log("PlantingRecords: ", vnode.state.plantingRecords);
      });
      const plantingIds = vnode.state.plantingRecords.map((record) =>
        record.recordId
      );
      console.log("PlantingIds: ", plantingIds);
      // Ensure plantingIds are available and contain values before fetching harvest records
      if (plantingIds && plantingIds.length > 0) {
        await api.get("records?recordType=harvest").then((harvestRecords) => {
          // Filter harvestRecords to those whose planting_id is in plantingIds
          const filteredHarvestRecords = harvestRecords.filter((record) =>
            plantingIds.includes(
              getPropertyValue(record, "planting_id")
            )
          );
          vnode.state.harvestRecords = filteredHarvestRecords;
          console.log("Filtered Harvest Records: ", vnode.state.harvestRecords);
        });
        const harvestIds = vnode.state.harvestRecords.map(
          (record) => record.recordId
        );

        if (harvestIds.length > 0) {
          const deliveryRecords = await api.get("records?recordType=delivery");
          const filteredDeliveryRecords = deliveryRecords.filter((record) =>
            harvestIds.includes(getPropertyValue(record, "harvest_id"))
          );
          vnode.state.deliveryRecords = filteredDeliveryRecords;
          console.log(
            "Filtered Delivery Records: ",
            vnode.state.deliveryRecords
          );
        }
        const deliveryIds = vnode.state.deliveryRecords.map(
          (record) => record.recordId
        );

        if (deliveryIds.length > 0) {
          const receptionRecords = await api.get(
            "records?recordType=reception"
          );
          const filteredReceptionRecords = receptionRecords.filter((record) =>
            deliveryIds.includes(getPropertyValue(record, "delivery_id"))
          );
          vnode.state.receptionRecords = filteredReceptionRecords;
          console.log(
            "Filtered Reception Records: ",
            vnode.state.receptionRecords
          );
        }
        const receptionIds = vnode.state.receptionRecords.map(
          (record) => record.recordId
        );
        if (receptionIds.length > 0) {
          const processingRecords = await api.get(
            "records?recordType=processing"
          );
          const filteredProcessingRecords = processingRecords.filter((record) =>
            receptionIds.includes(getPropertyValue(record, "reception_id"))
          );
          vnode.state.processingRecords = filteredProcessingRecords;
          console.log(
            "Filtered Processing Records: ",
            vnode.state.processingRecords
          );
        }
        const processingIds = vnode.state.processingRecords.map(
          (record) => record.recordId
        );
        if (processingIds.length > 0) {
          const riceRecords = await api.get("records?recordType=rice");
          const filteredRiceRecords = riceRecords.filter((record) =>
            processingIds.includes(getPropertyValue(record, "processing_id"))
          );
          vnode.state.riceRecords = filteredRiceRecords;
          console.log("Filtered Rice Records: ", vnode.state.riceRecords);
        }
      }

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
    if (!vnode.state.record) {
      return m(".alert-warning", `Loading Field ${vnode.attrs.recordId}`);
    }

    const record = vnode.state.record;
    const publicKey = api.getPublicKey();
    const isOwner = record.owner === publicKey;
    return m(
      ".field-detail",
      m("h3.text-center", record.recordId),
      _displayRecordDetails(record, vnode.state.owner),
      _displayInteractionButtons(record, isOwner)
    );
  },
};

const _displayRecordDetails = (record, owner) => {
  console.log("Owner ", owner);
  return [
    _row(
      _labelProperty("Pemilik", _agentLink(owner)),
      // _labelProperty('Kustodian', _agentLink(custodian))
      _labelProperty("Alamat", getPropertyValue(record, "address"))
    ),
    _row(
      _labelProperty(
        "Lokasi",
        _propLink(
          record,
          "location",
          formatLocation(getPropertyValue(record, "location"))
        )
      )
    ),
    _row(
      _labelProperty("Luas", getPropertyValue(record, "area")),
      _labelProperty("Irigasi", getPropertyValue(record, "irrigation"))
    ),
  ];
};

const _displayInteractionButtons = (record, isOwner) => {
  return m(
    ".row.m-2",
    m(".col.text-center", [
      // isCustodian && m('button.btn.btn-primary', { onclick: () => m.route.set(`/update-properties/${record.recordId}`) }, 'Update Properties'),
      m(
        "button.btn.btn-primary",
        { onclick: () => m.route.set(`/field-updates/${record.recordId}`) },
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

const _loadData = (recordId, state) => {
  return api.get(`records/${recordId}`).then((record) => {
    console.log("Record: ", record);
    return api.get("agents").then((agents) => {
      state.record = record;
      state.agents = agents;
      state.owner = agents.find((agent) => agent.key === record.owner);
    });
  });
};

module.exports = FieldDetail;
