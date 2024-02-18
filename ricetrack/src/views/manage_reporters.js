'use strict'

const m = require('mithril');
const api = require('../services/api');
const payloads = require('../services/payloads');
const { _revokeAuthorization, _authorizeReporter, _reporters } = require('./reporterUtils');
const { _agentByKey } = require('./recordUtils')
const { _answerProposal, ROLE_TO_ENUM } = require('./proposalUtils');

const _loadData = async (recordId, state) => {
  try {

    const record = await api.get(`records/${recordId}`);
    state.record = record;
    const agents = await api.get('agents');
    state.agents = agents;
    state.currentReporters = getCurrentReporters(record);
    state.potentialReporters = getPotentialReporters(agents, record, state.currentReporters);
    state.proposals = record.proposals;

    // Set selectedReporterKey to the first potential reporter after data load
    if (state.potentialReporters.length > 0) {
      state.selectedReporterKey = state.potentialReporters[0].key;
    }
    // Trigger a redraw in Mithril
    m.redraw();
  } catch (error) {
    console.error('Error loading data:', error);
  }
};

const getCurrentReporters = (record) => {
  const publicKey = api.getPublicKey();
  const allReporters = _reporters(record);
  return Object.entries(allReporters)
    .filter(([key, properties]) =>
      key !== publicKey &&
      key !== record.owner &&
      properties.includes('location')
    )
    .map(([key, properties]) => [key, properties]);
};

const getPotentialReporters = (agents, record, currentReporters) => {
  const currentReporterKeys = new Set(currentReporters.map(([key, _]) => key));

  const proposedReporterKeys = new Set(
    record.proposals
      .filter(proposal => proposal.role.toLowerCase() === 'reporter')
      .map(proposal => proposal.receivingAgent)
  );

  return agents.filter(agent =>
    !currentReporterKeys.has(agent.key) && // Cek apakah agen tidak termasuk di currentReporters
    !proposedReporterKeys.has(agent.key) && // Cek apakah agen tidak memiliki proposal tertunda sebagai reporter
    agent.key !== record.owner &&
    agent.key !== record.custodian
  );
};

const ManageReporters = {
  async oninit(vnode) {
    vnode.state.recordId = vnode.attrs.recordId;
    vnode.state.currentReporters = [];
    vnode.state.potentialReporters = [];
    vnode.state.selectedReporterKey = null;
    vnode.state.proposals = [];
    vnode.state.publicKey = api.getPublicKey();

    await _loadData(vnode.attrs.recordId, vnode.state)
    vnode.state.refreshId = setInterval(async () => {
      await _loadData(vnode.attrs.recordId, vnode.state);
    }, 2000);
  },

  onbeforeremove(vnode) {
    clearInterval(vnode.state.refreshId);
  },

  view(vnode) {
    if (!vnode.state.record) {
      return m('.alert-warning', 'Loading record data...');
    }

    const { recordId, agents, potentialReporters, currentReporters, selectedReporterKey } = vnode.state;
    const publicKey = vnode.state.publicKey;
    let proposalsToAnswer = vnode.state.proposals.filter(proposal =>
      proposal.issuingAgent === publicKey && proposal.role.toLowerCase() === 'reporter');

    let showManageReporterForm = proposalsToAnswer.length === 0;

    return m('.manage-reporters', [
      // Display proposals to answer
      proposalsToAnswer.length > 0 && proposalsToAnswer.map(proposal =>
        m('.proposal-to-answer',
          m('p', `Anda sudah meminta ${_agentByKey(agents, proposal.receivingAgent).name} menjadi Reporter produk ini.`),
          m('button.btn.btn-danger', {
            onclick: async () => {
              await _answerProposal(vnode.state.record, proposal.receivingAgent, ROLE_TO_ENUM[proposal.role.toLowerCase()], payloads.answerProposal.enum.CANCEL)
                .then(async () => await _loadData(vnode.attrs.recordId, vnode.state))
                .then(() => m.redraw())
                .catch(err => console.error('Error while answering proposal:', err));
            }
          }, 'Batalkan')
        )
      ),

      proposalsToAnswer.length > 0 && m('button.btn.btn-primary', {
        onclick: () => window.history.back()
      }, 'Kembali'),

      // Manage reporter form
      showManageReporterForm && [
        m('h1', 'Kelola Reporter'),
        m('h2', { style: { 'font-size': 'smaller' } }, `Record ID: ${recordId}`),
        m('h4', 'Current Reporters:'),
        // Current reporters
        currentReporters.map(([key, properties]) =>
          m('div.reporter-item', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } }, [
            m('h6', { style: { marginRight: '10px' } }, `${_agentByKey(agents, key).name}`),
            m('button.btn.btn-primary', {
              onclick: async () => {
                if (window.confirm('Apakah Anda yakin ingin mencabut otorisasi reporter ini?')) {
                  await _revokeAuthorization(recordId, key, properties);
                  await _loadData(vnode.attrs.recordId, vnode.state);
                }
              }
            }, 'Hapus')
          ])
        ),
        m('h4', 'Add Reporters:'),
        // Potential reporters
        potentialReporters.length > 0 && m('div',
          [
            m('select', {
              onchange: m.withAttr('value', value => vnode.state.selectedReporterKey = value),
              value: selectedReporterKey
            }, potentialReporters.map(agent => m('option', { value: agent.key }, agent.name))),
            m('button.btn.btn-primary', {
              onclick: async () => {
                if (selectedReporterKey) {
                  await _authorizeReporter(recordId, selectedReporterKey, ['location'])
                    .then(() => {
                      alert("Proposal menjadi reporter telah di kirim ke " + _agentByKey(agents, selectedReporterKey).name + ".")
                      window.history.back();
                    })
                    .catch(error => alert("Failed to send proposal: " + error.message));
                  // await _loadData(vnode.attrs.recordId, vnode.state);
                } else {
                  alert("Please select a reporter to authorize.");
                }
              }
            }, 'Authorize')
          ]
        )
      ]
    ]);
  }
}

module.exports = ManageReporters;
