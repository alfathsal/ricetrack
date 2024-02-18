'use strict'

const m = require('mithril')
const truncate = require('lodash/truncate')
const { Table, FilterGroup, PagingButtons } = require('../components/tables')
const api = require('../services/api')
const { getPropertyUpdates, getPropertyValue, getLatestPropertyUpdateTime, getOldestPropertyUpdateTime, countUniqueUpdates } = require('../utils/records')
const { _agentByKey } = require('./recordUtils');
const {
    formatDateTime,
    formatCurrency,
    formatLocation } = require('./formatUtils');

const RiceUpdates = {
    oninit: async (vnode) => {
        vnode.state.isLoading = true;
        vnode.state.record = null
        vnode.state.currentTab = 'Semua'
        vnode.state.agents = []

        try {
            const record = await api.get(`records/${vnode.attrs.recordId}`);
            vnode.state.record = record
            const agents = await api.get('agents')
            vnode.state.agents = agents
        } catch (error) {
            console.error('Error loading record:', error);
        } finally {
            vnode.state.isLoading = false;
            m.redraw(); // Memaksa Mithril untuk melakukan render ulang
        }

    },

    view(vnode) {
        if (vnode.state.isLoading) {
            return m('p', 'Memuat data...');
        }
        console.log('Record', vnode.state.record)
        console.log('Agents: ', vnode.state.agents)
        if (!vnode.state.record && !vnode.state.agents) {
            return m('.alert-warning', `Loading ${vnode.attrs.recordId}`)
        }
        return [
            m('h4.text-center', 'Riwayat'),
            m('h5.text-center', vnode.attrs.recordId),
            m('.tab-menu', _renderTabMenu(vnode)),
            vnode.state.currentTab === 'Semua' && _renderAllTab(vnode.state),
            vnode.state.currentTab === 'Pemilik' && _renderOwnerTab(vnode.state),
            // vnode.state.currentTab === 'Kustodian' && _renderCustodianTab(vnode.state),
            vnode.state.currentTab === 'Lokasi' && _renderLocationTab(vnode.state.record),
            vnode.state.currentTab === 'Harga' && _renderPriceTab(vnode.state.record),
        ]
    }
}

function aggregateUpdates(allUpdates) {
    const groupedByTimestamp = allUpdates.reduce((acc, update) => {
        if (!acc[update.timestamp]) {
            acc[update.timestamp] = { timestamp: update.timestamp, updates: [] };
        }
        acc[update.timestamp].updates.push(update);
        return acc;
    }, {});
    const lastKnownData = { owner: '', custodian: '', location: '', price: '' };
    const earliestTimestamp = allUpdates.length > 0 ? allUpdates[allUpdates.length - 1].timestamp : null;

    return Object.values(groupedByTimestamp).map(group => {
        const { timestamp, updates } = group;
        const uniqueUpdate = { timestamp, type: '', owner: '', custodian: '', location: '', price: '' };

        updates.forEach(update => {
            if (update.type === 'owner') {
                uniqueUpdate.owner = update.agentId;
                lastKnownData.owner = update.agentId;
            }
            if (update.type === 'custodian') {
                uniqueUpdate.custodian = update.agentId;
                lastKnownData.custodian = update.agentId;
            }
            if (update.type === 'location') {
                uniqueUpdate.location = update.updatedValue;
                lastKnownData.location = update.updatedValue;
            }
            if (update.type === 'price') {
                uniqueUpdate.price = update.updatedValue;
                lastKnownData.price = update.updatedValue;
            }
        });

        if (timestamp === earliestTimestamp) {
            uniqueUpdate.type = 'Pengemasan';
        } else if (updates.some(u => u.type === 'owner') && updates.some(u => u.type === 'price')) {
            uniqueUpdate.type = 'Penjualan';
        } else {
            const typeUpdate = updates.find(u => u.type);
            uniqueUpdate.type = typeUpdate ? typeMap[typeUpdate.type] : '';
        }

        uniqueUpdate.owner = uniqueUpdate.owner || lastKnownData.owner;
        uniqueUpdate.custodian = uniqueUpdate.custodian || lastKnownData.custodian;
        uniqueUpdate.location = uniqueUpdate.location || lastKnownData.location;
        uniqueUpdate.price = uniqueUpdate.price || lastKnownData.price;

        return uniqueUpdate;
    });
}

const typeMap = {
    owner: 'Penjualan',
    custodian: 'Perubahan Kustodian',
    location: 'Perubahan Lokasi',
    price: 'Perubahan Harga'
};

const _renderTabMenu = (vnode) => {
    const setTab = (tab) => () => { vnode.state.currentTab = tab }

    return m('ul.nav.nav-tabs', [
        m('li.nav-item', m('a.nav-link', { onclick: setTab('Semua'), class: vnode.state.currentTab === 'Semua' ? 'active' : '' }, 'Semua')),
        m('li.nav-item', m('a.nav-link', { onclick: setTab('Pemilik'), class: vnode.state.currentTab === 'Pemilik' ? 'active' : '' }, 'Pemilik')),
        // m('li.nav-item', m('a.nav-link', { onclick: setTab('Kustodian'), class: vnode.state.currentTab === 'Kustodian' ? 'active' : '' }, 'Kustodian')),
        m('li.nav-item', m('a.nav-link', { onclick: setTab('Lokasi'), class: vnode.state.currentTab === 'Lokasi' ? 'active' : '' }, 'Lokasi')),
        m('li.nav-item', m('a.nav-link', { onclick: setTab('Harga'), class: vnode.state.currentTab === 'Harga' ? 'active' : '' }, 'Harga'))
    ])
}

const _renderAllTab = (state) => {
    console.log('Record.updates', state.record.updates)
    if (!state.record) {
        return m('p', 'Tidak ada data.')
    }

    // Mengumpulkan update untuk owner, custodian, dan property
    const ownerUpdates = state.record.updates.owners ? state.record.updates.owners.map(update => ({
        timestamp: update.timestamp,
        agentId: update.agentId,
        type: 'owner'
    })) : [];
    /*
    const custodianUpdates = state.record.updates.custodians ? state.record.updates.custodians.map(update => ({
        timestamp: update.timestamp,
        agentId: update.agentId,
        type: 'custodian'
    })) : [];
    */
    const locationUpdates = getPropertyUpdates(state.record)
        .filter(update => update.propertyName === 'location')
        .map(update => {
            let updateCopy = Object.assign({}, update);
            delete updateCopy.propertyName; // Menghapus propertyName
            return Object.assign(updateCopy, { type: 'location' });
        }) || [];

    const priceUpdates = getPropertyUpdates(state.record)
        .filter(update => update.propertyName === 'price')
        .map(update => {
            let updateCopy = Object.assign({}, update);
            delete updateCopy.propertyName; // Menghapus propertyName
            return Object.assign(updateCopy, { type: 'price' });
        }) || [];



    // Menggabungkan semua updates dan mengurutkan berdasarkan timestamp
    const allUpdates = [...ownerUpdates, ...locationUpdates, ...priceUpdates];
    // allUpdates.sort((a, b) => b.timestamp - a.timestamp);
    console.log('All updates', allUpdates)

    const uniqueUpdates = aggregateUpdates(allUpdates);
    const filteredUpdates = uniqueUpdates.filter(update => update.type !== typeMap.price);
    filteredUpdates.sort((a, b) => b.timestamp - a.timestamp);

    // Render tabel
    return m('table.table.table-striped', [
        m('thead',
            m('tr', [
                m('th', 'Tanggal'),
                m('th', 'Keterangan'),
                m('th', 'Pemilik'),
                // m('th', 'Kustodian'),
                m('th', 'Lokasi'),
                m('th', 'Harga')
            ])
        ),
        m('tbody',
            filteredUpdates.map(update =>
                m('tr', [
                    m('td', formatDateTime(update.timestamp)),
                    m('td', update.type),
                    m('td', _agentByKey(state.agents, update.owner).name),
                //    m('td', _agentByKey(state.agents, update.custodian).name),
                    m('td', formatLocation(update.location)),
                    m('td', formatCurrency(update.price))
                ])
            ))
    ])
}



const _renderOwnerTab = (state) => {
    if (!state.record || !state.record.updates || !state.record.updates.owners) {
        return m('p', 'Tidak ada data perubahan kepemilikan.')
    }

    const ownerUpdates = state.record.updates.owners.map(update => ({
        timestamp: update.timestamp,
        agentId: update.agentId
    }));
    console.log('Owner updates', ownerUpdates)

    return m('table.table.table-striped', [
        m('thead',
            m('tr', [
                m('th', 'Tanggal'),
                m('th', 'Nama')
            ])
        ),
        m('tbody',
            ownerUpdates.map(update =>
                m('tr', [
                    m('td', formatDateTime(update.timestamp)),
                    m('td', _agentByKey(state.agents, update.agentId).name)
                ])
            )
        )
    ])
}


const _renderCustodianTab = (state) => {
    if (!state.record || !state.record.updates || !state.record.updates.custodians) {
        return m('p', 'Tidak ada data perubahan kepemilikan.')
    }

    const custodianUpdates = state.record.updates.custodians.map(update => ({
        timestamp: update.timestamp,
        agentId: update.agentId
    }));
    console.log('Custodian updates', custodianUpdates)
    return m('table.table.table-striped', [
        m('thead',
            m('tr', [
                m('th', 'Tanggal'),
                m('th', 'Nama')
            ])
        ),
        m('tbody',
            custodianUpdates.map(update =>
                m('tr', [
                    m('td', formatDateTime(update.timestamp)),
                    m('td', _agentByKey(state.agents, update.agentId).name)
                ])
            )
        )
    ])
}
const _renderLocationTab = (record) => {
    const locationUpdates = getPropertyUpdates(record).filter(update => update.propertyName === 'location');

    return m('table.table.table-striped', [
        m('thead',
            m('tr', [
                m('th', 'Tanggal'),
                m('th', 'Lokasi')
            ])
        ),
        m('tbody',
            locationUpdates.map(update =>
                m('tr', [
                    m('td', formatDateTime(update.timestamp)),
                    m('td', formatLocation(update.updatedValue))
                ])
            )
        )
    ]);
};
const _renderPriceTab = (record) => {
    const priceUpdates = getPropertyUpdates(record).filter(update => update.propertyName === 'price');

    return m('table.table.table-striped', [
        m('thead',
            m('tr', [
                m('th', 'Tanggal'),
                m('th', 'Harga')
            ])
        ),
        m('tbody',
            priceUpdates.map(update =>
                m('tr', [
                    m('td', formatDateTime(update.timestamp)),
                    m('td', formatCurrency(update.updatedValue)) // Asumsikan formatCurrency adalah fungsi yang Anda miliki
                ])
            )
        )
    ]);
};


module.exports = RiceUpdates
