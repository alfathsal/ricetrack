const m = require('mithril');
const api = require('../services/api');
const payloads = require('../services/payloads');
const { getPropertyValue } = require('../utils/records')
const { formatDateTime, formatDate, formatTimestamp, formatCurrency, formatLocation } = require('./formatUtils');
const { _answerProposal, ROLE_TO_ENUM } = require('./proposalUtils');
const { _agentByKey, _finalizeRecord } = require('./recordUtils');
const { show, BasicModal } = require('../components/modals');

const RiceDetail = {
    oninit(vnode) {
        vnode.state.record = null;
        vnode.state.agents = [];
        vnode.state.owner = null;
        vnode.state.custodian = null;
        _loadData(vnode.attrs.recordId, vnode.state);
        vnode.state.refreshId = setInterval(() => {
            _loadData(vnode.attrs.recordId, vnode.state);
        }, 60000);
    },

    onbeforeremove(vnode) {
        clearInterval(vnode.state.refreshId);
    },

    view(vnode) {
        if (!vnode.state.record) {
            return m('.alert-warning', `Loading ${vnode.attrs.recordId}`);
        }
        const record = vnode.state.record;
        const publicKey = api.getPublicKey();
        const isOwner = record.owner === publicKey;
        const isCustodian = record.custodian === publicKey;
        // check whether there is a proposal to answer for this user, whether proposal to be an owner, a custodian, or a reporter
        let proposalsToAnswer = record.proposals.filter(proposal => proposal.receivingAgent === publicKey);
        console.log('Proposals to answer: ', proposalsToAnswer);
/*
        // Log untuk mengecek properti dalam proposal
        console.log('Proposal diterima dengan properti:', proposalsToAnswer.properties);

        // Cari properti price dalam proposal
        const hargaProp = proposalsToAnswer.properties.find(prop => prop.name === 'price');
        if (hargaProp) {
            console.log('Harga dalam proposal:', hargaProp.intValue);
        } else {
            console.log('Tidak ada price yang ditetapkan dalam proposal');
        }
*/
        return m('.rice-detail',
            m('h3.text-center', record.recordId),
            // Menampilkan proposal yang perlu dijawab
            proposalsToAnswer.length > 0
                ? proposalsToAnswer.map(proposal =>
                    m('.proposal-to-answer',
                        m('p', `${_agentByKey(vnode.state.agents, proposal.issuingAgent).name} menawarkan produk ini kepada anda seharga ${formatCurrency(getPropertyValue(record, 'price'))}.`),
                        m('button.btn.btn-primary', {
                            onclick: () => {
                                _answerProposal(record, proposal.receivingAgent, ROLE_TO_ENUM[proposal.role.toLowerCase()], payloads.answerProposal.enum.ACCEPT)
                                    .then(() => {
                                        return _loadData(record.recordId, vnode.state); 
                                    })
                                    .then(() => {
                                        m.redraw(); 
                                    })
                                    .catch(err => {
                                        console.error('Error while answering proposal:', err);
                                    });
                            }
                        }, 'Terima'),
                        m('button.btn.btn-danger', {
                            onclick: () => {
                                _answerProposal(record, proposal.receivingAgent, ROLE_TO_ENUM[proposal.role.toLowerCase()], payloads.answerProposal.enum.REJECT)
                                    .then(() => {
                                        return _loadData(record.recordId, vnode.state); 
                                    })
                                    .then(() => {
                                        m.redraw(); 
                                    })
                                    .catch(err => {
                                        console.error('Error while answering proposal:', err);
                                    });
                            }
                        }, 'Tolak')
                    )
                )
                : null,
            _displayRecordDetails(record, vnode.state.owner, vnode.state.custodian),
            _displayInteractionButtons(record, publicKey, isOwner, isCustodian, vnode)
        );
    }
};

const _displayRecordDetails = (record, owner, custodian) => {
    console.log('Kedaluwarsa int: ', getPropertyValue(record, 'expiration_date', 0))
    return [
        _row(
            _labelProperty('Tanggal Produksi', formatTimestamp(record.creationTime)),
            _labelProperty('Tanggal Perubahan', formatTimestamp(record.updatedTime))
        ),
        _row(
            _labelProperty('Pemilik', _agentLink(owner)),
            // _labelProperty('Kustodian', _agentLink(custodian))
            _labelProperty('Tanggal Kemasan', formatTimestamp(getPropertyValue(record, 'packaging_date'))),
        ),
        _row(
            _labelProperty('Berat (kg)', getPropertyValue(record, 'weight', 0)),
            _labelProperty('Kedaluwarsa', formatTimestamp(getPropertyValue(record, 'expiration_date', 0)))
        ),
        _row(
            _labelProperty('Harga', formatCurrency(getPropertyValue(record, 'price'))),
            _labelProperty('Lokasi', _propLink(record, 'location', formatLocation(getPropertyValue(record, 'location'))))
        )
    ];
};

const _displayInteractionButtons = (record, publicKey, isOwner, isCustodian, vnode) => {
    return m('.row.m-2',
        m('.col.text-center',
            [
                // isCustodian && m('button.btn.btn-primary', { onclick: () => m.route.set(`/update-properties/${record.recordId}`) }, 'Update Properties'),
                m('button.btn.btn-primary', { onclick: () => m.route.set(`/rice-updates/${record.recordId}`) }, 'Lacak'),
                isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/transfer-ownership/${record.recordId}`) }, 'Jual'),
                // isCustodian && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/transfer-custodian/${record.recordId}`) }, 'Ubah Kustodian'),
                isOwner  && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/manage-reporters/${record.recordId}`) }, 'Kelola Reporter'),
                // isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => _finalizeWithConfirmation(vnode) }, 'Finalisasi')
            ]));
};

// Fungsi untuk menampilkan konfirmasi finalisasi
function _finalizeWithConfirmation(vnode) {
    show(BasicModal, {
        title: 'Konfirmasi Finalisasi',
        body: 'Apakah Anda yakin ingin menyelesaikan record ini? Tindakan ini tidak dapat dibatalkan.',
        acceptText: 'Ya',
        cancelText: 'Tidak'
    }).then(() => {
        // Use the record from the current vnode state
        _finalizeRecord(vnode.state.record)
            .then(() => {
                alert('Record successfully finalized');
                // Reload the data to reflect changes
                _loadData(vnode.attrs.recordId, vnode.state);
            })
            .catch(err => {
                console.error('Error finalizing record:', err);
                const errorMessage = err.response ? err.response.data.error : err.message;
                alert(`Error finalizing record: ${errorMessage}`);
            });
    })
        .catch(() => {
            console.log('Finalization cancelled');
        });
}

const _row = (...cols) => m('.row', cols.map((col) => m('.col', col)));
const _labelProperty = (label, value) => [m('dl', m('dt', label), m('dd', value))];
const _agentLink = (agent) => m(`a[href=/agents/${agent.key}]`, { oncreate: m.route.link }, agent.name);
const _propLink = (record, propName, content) =>
    m(`a[href=/properties/${record.recordId}/${propName}]`,
        { oncreate: m.route.link },
        content)

const _loadData = (recordId, state) => {
    return api.get(`records/${recordId}`)
        .then(record => Promise.all([record, api.get('agents')]))
        .then(([record, agents]) => {
            state.record = record;
            state.agents = agents;
            state.owner = agents.find(agent => agent.key === record.owner);
            state.custodian = agents.find(agent => agent.key === record.custodian);
        });
};

module.exports = RiceDetail;