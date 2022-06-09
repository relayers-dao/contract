import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Deposit,
  ExitQueue,
  Income,
  MERC20,
  MTornadoGovernanceStaking,
  MTornadoStakingRewards,
  MTornRouter,
  RootManger
} from "../typechain-types";
import {SignerWithAddress} from "hardhat-deploy-ethers/signers";
import {about, createFixture, Fixture} from "./utils";
import {set_up_fixture} from "./start_up";

describe("RootManger", function () {

  let usdc_erc20: MERC20,torn_erc20: MERC20;

  let mExitQueue :ExitQueue;
  let mTornRouter :MTornRouter;

  let mDeposit :Deposit;
  let mRootManger :RootManger;
  let mIncome :Income;

  let user1:SignerWithAddress,user2:SignerWithAddress,user3:SignerWithAddress,operator:SignerWithAddress ;
  let stake1:SignerWithAddress;
  let owner:SignerWithAddress;
  let dao_relayer1:SignerWithAddress;
  let relayer1:SignerWithAddress;
  let relayer2:SignerWithAddress,relayer3:SignerWithAddress


  let mTornadoGovernanceStaking:MTornadoGovernanceStaking;
  let mTornadoStakingRewards:MTornadoStakingRewards;
  beforeEach(async () => {
    let fix_info = await set_up_fixture("register_relayers");
    usdc_erc20 = fix_info.usdc_erc20;
    torn_erc20 = fix_info.torn_erc20;
    mTornRouter =fix_info.mTornRouter;
    mDeposit =fix_info.mDeposit;
    mIncome =  fix_info.mIncome;
    user1 = fix_info.user1;
    user2 = fix_info.user2;
    user3 = fix_info.user3;
    operator = fix_info.operator;
    stake1 = fix_info.stake1;
    mTornadoGovernanceStaking = fix_info.mTornadoGovernanceStaking;
    mRootManger = fix_info.mRootManger;
    mExitQueue = fix_info.mExitQueue;
    mTornadoStakingRewards = fix_info.mTornadoStakingRewards;

    owner = fix_info.owner;
    relayer1 = fix_info.dao_relayer1;
    relayer2 = fix_info.dao_relayer2;
    relayer3 = fix_info.dao_relayer3;

    let usdc = ethers.utils.parseUnits("1",6);
    await usdc_erc20.connect(user1).mint(user1.address,usdc.mul(1000));

    // deposit usdc for test
    usdc = ethers.utils.parseUnits("1",6);
    await usdc_erc20.connect(user1).approve(mTornRouter.address,usdc);
    await mTornRouter.connect(user1).deposit("usdc",usdc);
    await mTornRouter.connect(user1).withdraw("usdc",usdc,user2.address);

    //deposit eth for test
    let eth = ethers.utils.parseUnits("1000",18);
    await mTornRouter.connect(user1).deposit("eth", eth, {value: eth});
    await mTornRouter.connect(user1).withdraw("eth", eth, user2.address);

  });


  it("test balanceOfTorn and valueForTorn", async function () {
    let stake_torn = ethers.utils.parseUnits(Math.random()*100+"",18);
    await torn_erc20.connect(user3).mint(user3.address,stake_torn);
    await torn_erc20.connect(user3).approve(mDeposit.address,stake_torn);
    await mDeposit.connect(user3).depositWithApproval(stake_torn);
    expect(await mRootManger.balanceOfTorn(user3.address)).equal(stake_torn);
    expect(await mRootManger.valueForTorn(await mRootManger.balanceOf(user3.address))).equal(stake_torn);

    let stake_torn1 = ethers.utils.parseUnits(Math.random()*100+"",18);
    await torn_erc20.connect(user2).mint(user2.address,stake_torn1);
    await torn_erc20.connect(user2).approve(mDeposit.address,stake_torn1);
    await mDeposit.connect(user2).depositWithApproval(stake_torn1);

    expect(about(await mRootManger.balanceOfTorn(user2.address),stake_torn1)).true;
    expect(about(await mRootManger.valueForTorn(await mRootManger.balanceOf(user3.address)),stake_torn)).true;
  });

  it("test setOperator", async function () {
    await mRootManger.connect(owner).transferOwnership(user1.address);
    expect(await  mRootManger.owner()).equal(user1.address);
    await expect(mRootManger.connect(owner).setOperator(user1.address)).revertedWith("Ownable: caller is not the owner");
    await mRootManger.connect(user1).setOperator(user2.address);
    expect(await mRootManger.operator()).equal(user2.address);
  });


  it("test addRelayer", async function () {

    await expect(mRootManger.connect(user1).addRelayer(relayer1.address,0)).revertedWith("Ownable: caller is not the owner");
    // console.log(await mRootManger._relayers(0));
    await mRootManger.connect(owner).addRelayer(relayer1.address,1);
    expect(await mRootManger._relayers(1)).equal(relayer1.address);
    await expect(mRootManger.connect(owner).addRelayer(relayer1.address,1)).revertedWith("index err");
    await expect(mRootManger.connect(owner).addRelayer(relayer1.address,(await mRootManger.MAX_RELAYER_COUNTER()).add(1))).revertedWith("too large index");
     await mRootManger.connect(owner).addRelayer(relayer2.address,2);
     expect(await mRootManger._relayers(2)).equal(relayer2.address);
    await mRootManger.connect(owner).addRelayer(relayer3.address,(await mRootManger.MAX_RELAYER_COUNTER()).sub(1));
    expect(await mRootManger._relayers((await mRootManger.MAX_RELAYER_COUNTER()).sub(1))).equal(relayer3.address);

  });

  it("test removeRelayer", async function () {

    await expect(mRootManger.connect(user1).removeRelayer(0)).revertedWith("Ownable: caller is not the owner");

    await mRootManger.connect(owner).removeRelayer(0);
    await expect(mRootManger.connect(owner).removeRelayer(0)).revertedWith("index err");
    await mRootManger.connect(owner).addRelayer(relayer1.address,0);
    await expect(mRootManger.connect(owner).addRelayer(relayer1.address,0)).revertedWith("index err");
    await expect(mRootManger.connect(owner).removeRelayer(3)).revertedWith("index err");

    await mRootManger.connect(owner).addRelayer(relayer3.address,(await mRootManger.MAX_RELAYER_COUNTER()).sub(1));
    expect(await mRootManger._relayers(((await mRootManger.MAX_RELAYER_COUNTER()).sub(1)))).equal(relayer3.address);
    await mRootManger.connect(owner).removeRelayer((await mRootManger.MAX_RELAYER_COUNTER()).sub(1));
    expect(await mRootManger._relayers(((await mRootManger.MAX_RELAYER_COUNTER()).sub(1)))).equal("0x0000000000000000000000000000000000000000");
    await expect(mRootManger.connect(owner).removeRelayer((await mRootManger.MAX_RELAYER_COUNTER()).add(2))).revertedWith("too large index");
  });


});
