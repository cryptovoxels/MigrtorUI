/* global ethereum */
// Import the page's CSS. Webpack will know what to do with it.
import '../styles/app.css'

// Import libraries we need.
import Web3 from 'web3'
import contract from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import metaCoinArtifact from '../../build/contracts/MetaCoin.json'
import oldparcelArtifact from '../../build/contracts/OldParcel.json'
import parcelArtifact from '../../build/contracts/Parcel.json'
import migratorArtifact from '../../build/contracts/ParcelMigrator.json'
import IPaymaster from '../../build/contracts/IPaymaster.json'
import { networks } from './networks'

const Gsn = require('@opengsn/provider')

const RelayProvider = Gsn.RelayProvider

const Parcel = contract(parcelArtifact)
const OldParcel = contract(oldparcelArtifact)
const Migrator = contract(migratorArtifact)

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
let accounts
let account

var network

const App = {
  start: async function () {
    const self = this
    // This should actually be web3.eth.getChainId but MM compares networkId to chainId apparently
    web3.eth.net.getId(async function (err, networkId) {
      console.log({networkId})
      if (parseInt(networkId) < 1000) { // We're on testnet/
        network = networks[networkId]
        Parcel.deployed = () => Parcel.at(network.parcel)
        OldParcel.deployed = () => OldParcel.at(network.oldparcel)
        Migrator.deployed = () => Migrator.at(network.migrator)

        console.log(window.ethereum)
        const web3 = new Web3(window.ethereum);
        Parcel.setProvider(web3.currentProvider)
        OldParcel.setProvider(web3.currentProvider)
        accounts = await web3.eth.getAccounts();
        console.log({accounts})
        account = accounts[0];
        const oldparcelInstance = await OldParcel.deployed();
        const parcelInstance = await Parcel.deployed();
       
        // minting process from old parcel
        // console.log("minting", accounts)
        // await oldparcelInstance.mint(accounts[0],1,3,3,3,4,4,4,0, {from: accounts[0]})
        // console.log("minted")
        // await oldparcelInstance.setApprovalForAll(network.migrator,true,{from: accounts[0]}) 
        // await parcelInstance.transferOwnership(network.migrator, {from: accounts[0]})
      }

      const gsnConfig = {
        relayLookupWindowBlocks: 600000,
        loggerConfigration: {
          logLevel: window.location.href.includes('verbose') ? 'debug' : 'error'
        },
        paymasterAddress: network.paymaster
      }
      var provider = RelayProvider.newProvider({ provider: web3.currentProvider, config: gsnConfig })
      await provider.init()
      web3.setProvider(provider)

      Migrator.setProvider(web3.currentProvider)
    })
  },

  setStatus: function (message) {
    const status = document.getElementById('status')
    status.innerHTML = message
  },

  link: function (path, text) {
    return '<a href="' + network.baseurl + path + '">' + text + '</a>'
  },

  addressLink: function (addr) {
    return '<a href="' + network.addressUrl + addr + '" target="_info">' + addr + '</a>'
  },

  txLink: function (addr) {
    return '<a href="' + network.txUrl + addr + '" target="_info">' + addr + '</a>'
  },

  migrate: function () {
    const self = this
    Migrator.deployed().then(async function (instance) {
      self.setStatus('Migrating... (please wait)')
      
      return instance.migrate([1],{from: account})
    }).then(function (res) {
      // self.refreshBalance()
      self.setStatus('Mint transaction complete!<br>\n' + self.txLink(res.tx))
    }).catch(function (err) {
      console.log('mint error:', err)
      self.setStatus('Error getting balance; see log.')
    })
  },
}

window.App = App
window.addEventListener('load', async () => {
  // Modern dapp browsers...
  if (window.ethereum) {
    console.warn(
      'Using web3 detected from external source.' +
      ' If you find that your accounts don\'t appear or you have 0 MetaCoin,' +
      ' ensure you\'ve configured that source properly.' +
      ' (and allowed the app to access MetaMask.)' +
      ' If using MetaMask, see the following link.' +
      ' Feel free to delete this warning. :)' +
      ' http://truffleframework.com/tutorials/truffle-and-metamask'
    )
    window.web3 = new Web3(ethereum)
    try {
      // Request account access if needed
      await ethereum.enable()

      ethereum.on('chainChanged', (chainId)=>{
        console.log( 'chainChanged', chainId)
        window.location.reload()
      })
      ethereum.on('accountsChanged', (accs)=>{
        console.log( 'accountChanged', accs)
        window.location.reload()
      })

    } catch (error) {
      // User denied account access...
      alert('NO NO NO')
    }
  } else if (window.web3) {
    // Legacy dapp browsers...
    window.web3 = new Web3(web3.currentProvider)
  } else {
    console.warn(
      'No web3 detected. Falling back to http://127.0.0.1:9545.' +
      ' You should remove this fallback when you deploy live, as it\'s inherently insecure.' +
      ' Consider switching to Metamask for development.' +
      ' More info here: http://truffleframework.com/tutorials/truffle-and-metamask'
    )
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:9545'))
  }
  await App.start()
})
