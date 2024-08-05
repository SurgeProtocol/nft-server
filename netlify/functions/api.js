require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const { ethers } = require("ethers");
const { Multicall } = require('ethereum-multicall');

const router = express.Router();
var cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
});

const rpcs = {
    42161: process.env.ARBITRUM_RPC,
    8453: process.env.BASE_RPC,
};

const abi = require("../../src/deal.json");

router.get('/chain/:chainId/deal/:address/token/:tokenId', async (req, res) => {
    const { chainId, address, tokenId } =  req.params;

    if(!chainId || !address || !tokenId){
        res.status(400).json({ error: "Invalid parameters" });
        return;
    }

    try {
        const rpc = rpcs[chainId];
        const provider = new ethers.JsonRpcProvider(rpc);
        const multicall = new Multicall({ nodeUrl: rpc, tryAggregate: true });

        const callInfo = {
            reference: 'deal',
            contractAddress: address,
            abi: abi,
            calls: [
                { reference: 'name', methodName: 'name' },
                { reference: 'description', methodName: 'description' },                
                { reference: 'stakedAmount', methodName: 'stakedAmount', methodParameters: [tokenId] },
                { reference: 'claimedAmount', methodName: 'claimedAmount', methodParameters: [tokenId] },
                { reference: 'ownerOf', methodName: 'ownerOf', methodParameters: [tokenId] },
                { reference: 'tokenBoundAccount', methodName: 'getTokenBoundAccount', methodParameters: [tokenId] },
                { reference: 'image', methodName: 'image' },
            ],
        }

        const results = (await multicall.call(callInfo)).results['deal']['callsReturnContext'];;

        const response = {
            id: tokenId,
            name: results[0].returnValues[0],
            description: results[1].returnValues[0],
            staked: parseInt(results[2].returnValues[0].hex, 16),
            claimed: parseInt(results[3].returnValues[0].hex, 16),
            owner: results[4].returnValues[0],
            tba: results[5].returnValues[0],
            image: results[6].returnValues[0],
        }

        res.header("Content-Type",'application/json');
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.use('/', router);

module.exports.handler = serverless(app);
module.exports.APP = app;


