pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "./Interface/IDepositContract.sol";
import "./Interface/IRootManger.sol";
import "./Interface/IExitQueue.sol";
import "./Interface/ITornadoStakingRewards.sol";
import "./Interface/ITornadoGovernanceStaking.sol";
import "./Interface/IRelayerRegistry.sol";
import "./RootManger.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";




contract ProfitRecord is Initializable, ReentrancyGuardUpgradeable{

    address immutable public ROOT_MANAGER;
    address immutable public TORN_CONTRACT;

    struct PRICE_STORE {
        uint256 price;
        uint256 amount;
    }

    mapping(address => PRICE_STORE) public profitStore;
      modifier onlyDepositContract() {
        require(msg.sender == IRootManger(ROOT_MANAGER).depositContract(), "Caller is not depositContract");
        _;
    }


    /** ---------- constructor ---------- **/
    constructor(address _tornContract, address _root_manager ) {
        TORN_CONTRACT = _tornContract;
        ROOT_MANAGER = _root_manager;
    }

    /** ---------- init ---------- **/
    function __ProfitRecord_init() public initializer {
        __ReentrancyGuard_init();
    }


    function  newDeposit(address addr,uint256 torn_amount,uint256 amount_root_token) nonReentrant onlyDepositContract public{
        PRICE_STORE memory userStore = profitStore[addr];

//        console.log("newDeposit amount_root_token %d",amount_root_token);
//        console.logAddress(addr);

        if(userStore.amount == 0){
           uint256 new_price = torn_amount*(10**18)/amount_root_token;
           profitStore[addr].price = new_price;
           profitStore[addr].amount = amount_root_token;
        }else{
              // calc weighted average
              profitStore[addr].price =  (userStore.amount*userStore.price +torn_amount*(10**18))/(amount_root_token+userStore.amount);
              profitStore[addr].amount =  amount_root_token+userStore.amount;
        }

    }

    function  withDraw(address addr,uint256 amount_root_token) nonReentrant onlyDepositContract public returns (uint256 profit) {


//        console.log("withDraw amount_root_token %d",amount_root_token);
//        console.logAddress(addr);

        profit = getProfit(addr,amount_root_token);
        if(profitStore[addr].amount > amount_root_token){
            profitStore[addr].amount -= amount_root_token;
        }
        else{
           delete profitStore[addr];
        }
    }

    function  getProfit(address addr,uint256 amount_root_token) public view returns (uint256 profit){
        PRICE_STORE memory userStore = profitStore[addr];
//        console.log("userStore.amount %d",userStore.amount);
//        console.logAddress(addr);
//        console.log("amount_root_token %d",amount_root_token);



        require(userStore.amount >= amount_root_token,"err root token");
        uint256 value = IRootManger(ROOT_MANAGER).valueForTorn(amount_root_token);
        profit = value - (userStore.price*amount_root_token/10**18);
    }

}
