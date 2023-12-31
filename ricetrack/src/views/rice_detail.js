const m = require('mithril');
const api = require('../services/api');
const payloads = require('../services/payloads');
const { getPropertyValue } = require('../utils/records')
const { _formatDateTime, _formatDate, _formatTimestamp, _formatPrice, _formatLocation } = require('./formatUtils');
const { _answerProposal, ROLE_TO_ENUM } = require('./proposalUtils');
const { _finalizeRecord } = require('./recordUtils');
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

        return m('.rice-detail',
            m('h1.text-center', record.recordId),
            // Menampilkan proposal yang perlu dijawab
            _renderProposalsToAnswer(vnode),
            _displayRecordDetails(record, vnode.state.owner, vnode.state.custodian),
            _displayInteractionButtons(record, publicKey, isOwner, isCustodian, vnode)
        );
    }
};

function _renderProposalsToAnswer(vnode) {
    const record = vnode.state.record;
    const pendingProposals = record.proposals.filter(proposal => proposal.receivingAgent === api.getPublicKey());

    // Jika ada proposal tertunda, tampilkan modal
    if (pendingProposals.length > 0) {
        pendingProposals.forEach(proposal => {
            _showProposalModal(vnode, proposal);
        });
    }
}

function _showProposalModal(vnode, proposal) {
    show(BasicModal, {
        title: 'Proposal Details',
        body: m('div', [
            m('p', `Anda diminta menjadi ${proposal.role.toLowerCase()} produk ini`),
            m('p', `oleh ${proposal.issuingAgent}`),
        ]),
        acceptText: 'Terima',
        cancelText: 'Tolak',
        acceptFn: () => _handleProposalResponse(vnode, proposal, true), // true for accept
        cancelFn: () => _handleProposalResponse(vnode, proposal, false) // false for reject
    });
}

function _handleProposalResponse(vnode, proposal, accept) {
    _answerProposal(vnode.state.record, proposal.receivingAgent, ROLE_TO_ENUM[proposal.role.toLowerCase()], accept ? payloads.answerProposal.enum.ACCEPT : payloads.answerProposal.enum.REJECT)
        .then(() => {
            alert(`Proposal ${accept ? 'accepted' : 'rejected'} successfully.`);
            _loadData(vnode.attrs.recordId, vnode.state);
            m.redraw();
        }).catch(err => {
            alert(`Error responding to proposal: ${err.message}`);
        });
}


const _displayRecordDetails = (record, owner, custodian) => {
    return [
        _row(
            _labelProperty('Created', _formatTimestamp(record.creationTime)),
            _labelProperty('Updated', _formatTimestamp(record.updatedTime))
        ),
        _row(
            _labelProperty('Pemilik', _agentLink(owner)),
            _labelProperty('Kustodian', _agentLink(custodian))
        ),
        _row(
            _labelProperty('Tanggal Transaksi Terakhir', _formatDateTime(getPropertyValue(record, 'tgltransaksi', 0))),
            _labelProperty('Kedaluwarsa', _formatDate(getPropertyValue(record, 'kedaluwarsa', 0)))
        ),
        _row(
            _labelProperty('Varietas', getPropertyValue(record, 'varietas')),
            _labelProperty('Berat (kg)', getPropertyValue(record, 'berat', 0))
        ),
        _row(
            _labelProperty('Harga', _formatPrice(getPropertyValue(record, 'harga'))),
            _labelProperty('Lokasi', _propLink(record, 'lokasi', _formatLocation(getPropertyValue(record, 'lokasi'))))

        )
    ];
};

const _displayInteractionButtons = (record, publicKey, isOwner, isCustodian, vnode) => {
    return m('.row.m-2',
        m('.col.text-center',
            [
                // isCustodian && m('button.btn.btn-primary', { onclick: () => m.route.set(`/update-properties/${record.recordId}`) }, 'Update Properties'),
                m('button.btn.btn-primary', { onclick: () => m.route.set(`/rice-updates/${record.recordId}`) }, 'xLacak'),
                isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/transfer-ownership/${record.recordId}`) }, 'Jual'),
                isCustodian && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/transfer-custodian/${record.recordId}`) }, 'Ubah Kustodian'),
                isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => m.route.set(`/manage-reporters/${record.recordId}`) }, 'Kelola Reporter'),
                isCustodian && isOwner && !record.final && m('button.btn.btn-primary', { onclick: () => _finalizeWithConfirmation(vnode) }, 'Finalisasi')
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
            state.owner = agents.find(agent => agent.key === record.owner);
            state.custodian = agents.find(agent => agent.key === record.custodian);
        });
};

module.exports = RiceDetail;
