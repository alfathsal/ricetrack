'use strict'

const m = require('mithril');
const moment = require('moment');
const payloads = require('../services/payloads');
const transactions = require('../services/transactions');
const api = require('../services/api');
const parsing = require('../services/parsing');
const {getPropertyValue} = require('../utils/records')

const TransferOwnership = {
    oninit: (vnode) => {
        vnode.state.record = null;
        vnode.state.agents = [];
        vnode.state.selectedAgent = null;
        vnode.state.price = '';

        // Load the record and agents
        Promise.all([
            api.get(`records/${vnode.attrs.recordId}`),
            api.get('agents')
        ]).then(([record, agents]) => {
            vnode.state.record = record;
            vnode.state.agents = agents.filter(agent => agent.key !== record.owner);
            vnode.state.price = parseInt(getPropertyValue(record, 'price', 0)).toLocaleString('id');
            // Set the initial selected agent if agents are available
            if (vnode.state.agents.length > 0) {
                vnode.state.selectedAgent = vnode.state.agents[0].key;
            } else {
                // Handle the case where no agents are available
                vnode.state.selectedAgent = 'Tidak ada Agent yang tersedia'; // or set to null or any other default value
            }
        });
    },

    view: (vnode) => {
        return m('.transfer-ownership',
            m('h2', `Penjualan ${vnode.attrs.recordId}`),
            m('.form-group',
                m('label', 'Pilih Pembeli:'),
                m('select.form-control', {
                    onchange: m.withAttr('value', (value) => {
                        vnode.state.selectedAgent = value;
                    })
                }, vnode.state.agents.map(agent =>
                    m('option', { value: agent.key }, agent.name)
                ))
            ),
            m('.form-group',
                m('label', 'Harga (Rp):'),
                m('input.form-control', {
                    type: 'text',
                    value: vnode.state.price,
                    onchange: m.withAttr('value', value => {
                        vnode.state.price = value;
                    })
                })
            ),
            m('.form-group',
                m('button.btn.btn-primary', {
                    onclick: () => _submitTransfer(vnode)
                }, 'Jual')
            )
        );
    }
}

const _submitTransfer = (vnode) => {
    const price = parseInt(vnode.state.price.replace(/[^0-9]/g, ''), 10);
    console.log('price', price);
    const recordId = vnode.state.record.recordId;
    const selectedAgent = vnode.state.selectedAgent;

    // Refactored Update Payload
    const updateHarga = {
        name: 'price',
        dataType: payloads.updateProperties.enum.INT,
        intValue: price
    };

    const updatePayload = payloads.updateProperties({
        recordId: recordId,
        properties: [updateHarga]
    });

    // Submit the updateProperties transaction
    transactions.submit([updatePayload], true)
        .then(() => {
            console.log('Harga updated successfully');

            // Payload for creating a proposal
            const transferPayload = payloads.createProposal({
                recordId: recordId,
                receivingAgent: selectedAgent,
                role: payloads.createProposal.enum.OWNER
            });

            // Submit the createProposal transaction
            return transactions.submit([transferPayload], true);
        })
        .then(() => {
            console.log('Proposal created successfully');
            alert('Penjualan sudah dilakukan, menunggu konfirmasi dari pembeli.');
            m.route.set(`/rice/${recordId}`);
        })
        .catch(error => {
            console.error('Failed to update price or create proposal:', error);
        });
}

module.exports = TransferOwnership;
