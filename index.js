#!/usr/bin/env node

require('dotenv').config()

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET_KEY,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET,
  TWITTER_MESSAGE_TEMPLATE,
  WSURL,
  ETHERSCAN_ABI_URL,
  ETHERSCAN_API_KEY,
  CONTRACT_ADDRESS,
  GENESIS_BLOCK,
  CONTRACT_EVENTS } = process.env

const axios = require('axios')
const CONTRACT_EVENTS_ARRAY = CONTRACT_EVENTS.split(',')
const Web3 = require('web3')
const Twitter = require('twitter')
const restClient = require('node-rest-client-promise').Client();
const web3 = new Web3(new Web3.providers.WebsocketProvider(WSURL))
const twitterClient = new Twitter({
  consumer_key: TWITTER_API_KEY,
  consumer_secret: TWITTER_API_SECRET_KEY,
  access_token_key: TWITTER_ACCESS_TOKEN,
  access_token_secret: TWITTER_ACCESS_TOKEN_SECRET
})

async function postToTwitter({from, to, tokenID, totalSupply}) {

  console.log({from, to, tokenID, totalSupply})
  const metadata = await axios.get(`https://virus.folia.app/metadata/${tokenID}`)
  console.log({metadata})

  // need to upload an image here. simple link doesn't show.

  const msg = `${metadata.data.name} — ${metadata.data.description} ${metadata.data.image}`
  // TWITTER_MESSAGE_TEMPLATE="${event.event} event heard at transaction hash ${event.transactionHash}, Block number: ${event.blockNumber}"
  // const msg = eval('`'+ TWITTER_MESSAGE_TEMPLATE + '`')
  // const msg = event.toString()
  return twitterClient.post('statuses/update', {status: msg},  function(error, tweet, response) {
      console.log({error, tweet, response})
      if (error) return console.error(JSON.stringify(error))
  });
  
}

async function getContractAbi() {
  const url = `${ETHERSCAN_ABI_URL}${CONTRACT_ADDRESS}&apiKey=${ETHERSCAN_API_KEY}`
  const etherescan_response = await restClient.getPromise(url)
  const contract_abi = JSON.parse(etherescan_response.data.result)
  return contract_abi
}

async function eventQuery(){
	const contract_abi = await getContractAbi()
  const contract = new web3.eth.Contract(contract_abi, CONTRACT_ADDRESS)


  contract.getPastEvents('Infect', {
    fromBlock: GENESIS_BLOCK
  }).then(async events => {
    console.log(`there are ${events.length} events`)
    for (var i = 0; i < events.length; i++) {
      var event = events[i]

      if (event.event == "Infect") {
        // totalSupply = await contract.methods.totalSupply().call()
        // console.log({totalSupply})
        postToTwitter({
          from: event.returnValues.from,
          to: event.returnValues.to,
          tokenID: event.returnValues.tokenId,
          // totalSupply: i + 1
        })
      }
    }

  })

  let lastHash
	contract.events.allEvents()
		.on('data', async (event) => {
      if (event.event == "Infect" && event.transactionHash !== lastHash) {
        lastHash = event.transactionHash // dedupe
        // totalSupply = await contract.methods.totalSupply().call(undefined, event.blockNumber)
        postToTwitter({
          from: event.returnValues.from,
          to: event.returnValues.to,
          tokenID: event.returnValues.tokenId,
          // totalSupply
        })
      }
		})
		.on('error', console.error)
}

eventQuery()
