
const Client=require("@triton-one/yellowstone-grpc");
const bs58=require("bs58")

const RAYDIUM_OPENBOOK_AMM="675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
const PUMPFUN_BONDINGCURVE="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';


function connectGeyser(){
    const client =new Client.default("http://127.0.0.1:10000/",undefined,undefined);
    client.getVersion()
    .then(async version=>{
        try {
            console.log(version)
            const request =Client.SubscribeRequest.fromJSON({
                accounts: {},
                slots: {},
                transactions: {
                    pumpfun: {
                        vote: false,
                        failed: false,
                        signature: undefined,
                        accountInclude: [PUMPFUN_BONDINGCURVE, RAYDIUM_OPENBOOK_AMM],
                        accountExclude: [],
                        accountRequired: [],
                    },
                },
                transactionsStatus: {},
                entry: {},
                blocks: {},
                blocksMeta: {},
                accountsDataSlice: [],
                ping: undefined,
                commitment: Client.CommitmentLevel.PROCESSED
            })
        
            const stream =await client.subscribe();
            stream.on("data", async (data) => {
                if(data.transaction&&data.transaction.transaction&&data.transaction.transaction.signature) {
                    const transaction=data.transaction.transaction;
                    const sig=bs58.default.encode(data.transaction.transaction.signature);
                    const allAccounts=[];
                    transaction.transaction.message.accountKeys.map((account,index)=>{
                        if(!account) return;
                        const accountID=bs58.default.encode(account);
                        allAccounts.push(accountID);
                    })

                    transaction.meta.loadedWritableAddresses.map((account,index)=>{
                        if(!account) return;
                        const accountID=bs58.default.encode(account);
                        allAccounts.push(accountID);
                    })
                    transaction.meta.loadedReadonlyAddresses.map((account,index)=>{
                        if(!account) return;
                        const accountID=bs58.default.encode(account);
                        allAccounts.push(accountID);
                    })

                    const signers=allAccounts.slice(0,transaction.transaction.signatures.length)

                    if(allAccounts.includes(PUMPFUN_BONDINGCURVE)||allAccounts.includes(RAYDIUM_OPENBOOK_AMM)){
                        const currentTime=new Date()

                        var allInstructions=transaction.transaction.message.instructions

                        for(var oneInnerInstruction of transaction.meta.innerInstructions){
                            for(var oneInstruction of oneInnerInstruction.instructions){
                                allInstructions.push(oneInstruction);
                            }
                        }
                        // RAYDIUM
                        if(allAccounts.includes(RAYDIUM_OPENBOOK_AMM)){
                            if(!transaction.meta.logMessages.some(log=>log.includes("InitializeMint")||log.includes("initialize2"))){
                                return;
                            }
                            const createInstruction=allInstructions.find(instruction =>allAccounts[instruction.programIdIndex]==RAYDIUM_OPENBOOK_AMM);
                            if(!createInstruction){
                                console.log("NO Create Instruction!")
                                return;
                            }
                            const tokenAIndex = 8;
                            const tokenBIndex = 9;
                            const lpMintIndex = 7;
                            const marketKeyIndex = 16;
                            const marketIdIndex=4;
                            const tokenAAccount = allAccounts[createInstruction.accounts[tokenAIndex]];
                            const tokenBAccount = allAccounts[createInstruction.accounts[tokenBIndex]];
                            const marketAccountKey= allAccounts[createInstruction.accounts[marketKeyIndex]];
                            const marketId= allAccounts[createInstruction.accounts[marketIdIndex]];
                            const targetToken=(tokenAAccount==SOL_MINT_ADDRESS)?tokenBAccount:tokenAAccount;
                            const quoted=(tokenAAccount==SOL_MINT_ADDRESS)?true:false;
                            const solVault=quoted?allAccounts[createInstruction.accounts[10]]:allAccounts[createInstruction.accounts[11]];
                            const tokenVault=quoted?allAccounts[createInstruction.accounts[11]]:allAccounts[createInstruction.accounts[10]];
                            console.log(`====================================================================`)
                            console.log(`RAYDIUM`)
                            console.log(`https://solscan.io/tx/${sig}`)
                            console.log(`https://photon-sol.tinyastro.io/en/lp/${targetToken}`)
                            console.log(`CREATE`)
                            console.log({targetToken,marketId,signers,solVault,tokenVault,marketAccountKey})
                            console.log(`====================================================================`)
                        }

                        //Pumpfun
                        else if(allAccounts.includes(PUMPFUN_BONDINGCURVE)){
                            //Launch
                            if(transaction.meta.logMessages.some(log=>log.includes("Program log: Instruction: InitializeMint2"))){
                                const createInstruction=allInstructions.find(instruction =>allAccounts[instruction.programIdIndex]==PUMPFUN_BONDINGCURVE);
                                if(!createInstruction){
                                    return;
                                }
                                var bondingCurve=null;
                                var bondingCurveVault=null;
                                var targetToken=null;
                                targetToken=allAccounts[createInstruction.accounts[0]];
                                bondingCurve=allAccounts[createInstruction.accounts[2]];
                                bondingCurveVault=allAccounts[createInstruction.accounts[3]];
                                const bondingCurveSOLBalanceChange=transaction.meta.postBalances[createInstruction.accounts[2]]-transaction.meta.preBalances[createInstruction.accounts[2]];
                                const bondingCurveTokenBalance=transaction.meta.postTokenBalances.find(tokenBalance=>((tokenBalance.owner==bondingCurve)&&(tokenBalance.mint!=SOL_MINT_ADDRESS)));
                                if(!bondingCurveTokenBalance){
                                    return
                                }
                                const leftSol=85000000000-transaction.meta.postBalances[createInstruction.accounts[2]];
                                const leftTokens=bondingCurveTokenBalance.uiTokenAmount.uiAmount - 206900000;
                                const bondingCurveRealPercent=100 - (((bondingCurveTokenBalance.uiTokenAmount.uiAmount - 206900000) * 100) / 793100000)
                                console.log(`======PUMPFUN - New Token=======================================================`)
                                console.log(`https://solscan.io/tx/${sig}`);
                                console.log({signer:allAccounts[0]});
                                console.log(`https://photon-sol.tinyastro.io/en/lp/${bondingCurve}`)
                                console.log({targetToken})
                                console.log(`${bondingCurveRealPercent} %`)
                                console.log(`${leftSol/(10**9).toFixed(2)} SOL left`)
                                console.log(`${leftTokens} TOKENS left`)
                                console.log(`====================================================================`)
                            }
                            //SWAP
                            else if(transaction.meta.logMessages.some(log=>log.includes("Program log: Instruction: Buy"))||transaction.meta.logMessages.some(log=>log.includes("Program log: Instruction: Sell"))){
                                const swapInstruction=allInstructions.find(instruction =>allAccounts[instruction.programIdIndex]==PUMPFUN_BONDINGCURVE);
                                if(swapInstruction){
                                    var bondingCurve=null;
                                    var bondingCurveVault=null;
                                    bondingCurve=allAccounts[swapInstruction.accounts[3]];
                                    bondingCurveVault=allAccounts[swapInstruction.accounts[4]];
                                    const bondingCurveSOLBalanceChange=transaction.meta.postBalances[swapInstruction.accounts[3]]-transaction.meta.preBalances[swapInstruction.accounts[3]];
                                    
                                    const bondingCurveTokenBalance=transaction.meta.postTokenBalances.find(tokenBalance=>((tokenBalance.owner==bondingCurve)&&(tokenBalance.mint!=SOL_MINT_ADDRESS)));
                                    const bondingCurveRealPercent=100 - (((bondingCurveTokenBalance.uiTokenAmount.uiAmount - 206900000) * 100) / 793100000)
                                    const targetToken=bondingCurveTokenBalance.mint;
                                    
                                    const leftSol=85000000000-transaction.meta.postBalances[swapInstruction.accounts[3]];
                                    const leftTokens=bondingCurveTokenBalance.uiTokenAmount.uiAmount - 206900000;
                                    
                                    console.log(`=====PUMPFUN - SWAP=========================================================`)
                                    console.log(`https://solscan.io/tx/${sig}`);
                                    console.log({signer:allAccounts[0]});
                                    console.log(`https://photon-sol.tinyastro.io/en/lp/${bondingCurve}`)
                                    console.log({targetToken})
                                    console.log(`${bondingCurveRealPercent} %`)
                                    console.log(`${leftSol/(10**9).toFixed(2)} SOL left`)
                                    console.log(`${leftTokens} TOKENS left`)
                                    console.log(`====================================================================`)
                                    
                                }
                            }
                            
                        }

                    }

                }
            });
            await new Promise((resolve, reject) => {
                stream.write(request, (err) => {
                    if (err === null || err === undefined) {
                    resolve();
                    } else {
                    reject(err);
                    }
                });
            }).catch((reason) => {
                console.error(reason);
                throw reason;
            });
        } catch (error) {
            console.log(error)
            console.log("RECONNECTING!!!")
            setTimeout(() => {
                //attempt reconnect recursively
                connectGeyser()
            }, 2000);
            
        }

    });
}

connectGeyser()