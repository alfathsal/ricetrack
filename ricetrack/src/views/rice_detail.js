const m = require('mithril');
const api = require('../services/api');

const RiceDetail = {
    oninit(vnode) {
        vnode.state.riceRecord = null;
        vnode.state.processingRecord = null;
        vnode.state.receptionRecord = null;
        vnode.state.deliveryRecord = null;
        vnode.state.harvestRecord = null;
        vnode.state.plantingRecord = null;
        vnode.state.fieldRecord = null;

        api.get(`records/${vnode.attrs.recordId}`).then((record) => {
            vnode.state.riceRecord = record;
            return api.get(`records/${riceRecord.properties.processing_id.stringValue}`);
        }).then((processingRecord) => {
            vnode.state.processingRecord = processingRecord;
            return api.get(
              `records/${processingRecord.properties.reception_id.stringValue}`
            );
        }).then((receptionRecord) => {
            vnode.state.receptionRecord = receptionRecord;
            return api.get(
              `records/${receptionRecord.properties.delivery_id.stringValue}`
            );
        }).then((deliveryRecord) => {
            vnode.state.deliveryRecord = deliveryRecord;
            return api.get(
              `records/${deliveryRecord.properties.harvest_id.stringValue}`
            );
        }).then((harvestRecord) => {
            vnode.state.harvestRecord = harvestRecord;
            return api.get(
              `records/${harvestRecord.properties.planting_id.stringValue}`
            );
        }).then((plantingRecord) => {
            vnode.state.plantingRecord = plantingRecord;
            return api.get(
              `records/${plantingRecord.properties.field_id.stringValue}`
            );
        }).then((fieldRecord) => {
            vnode.state.fieldRecord = fieldRecord;
            m.redraw();
        }).catch(console.error);
    },

    view(vnode) {
        if (!vnode.state.riceRecord || !vnode.state.processingRecord || !vnode.state.receptionRecord || !vnode.state.deliveryRecord || !vnode.state.harvestRecord || !vnode.state.plantingRecord || !vnode.state.fieldRecord) {
            return m('div', 'Loading...');
        }

        return m('div.rice-details', [
            m('h2', 'Rice Details'),
            m('p', `Variety: ${vnode.state.plantingRecord.properties.variety.stringValue}`),
            m('p', `Location: Latitude ${vnode.state.fieldRecord.properties.location.locationValue.latitude}, Longitude ${vnode.state.fieldRecord.properties.location.locationValue.longitude}`),
            m('p', `Packaging Date: ${new Date(vnode.state.riceRecord.properties.packaging_date.intValue * 1000).toLocaleDateString()}`),
            m('p', `Expiration Date: ${new Date(vnode.state.riceRecord.properties.expiration_date.intValue * 1000).toLocaleDateString()}`),
            m('p', `Weight: ${vnode.state.riceRecord.properties.weight.intValue} kg`),
            m('p', `Price: $${vnode.state.riceRecord.properties.price.intValue}`),
        ]);
    }
};

module.exports = RiceDetail;
