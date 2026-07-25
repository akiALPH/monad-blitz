// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IMonadBlitzAsset {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getTotalTaps(uint256 tokenId) external view returns (uint256);
    function transferAsset(uint256 tokenId, address to) external;
}

contract MonadBlitzStaking {
    IMonadBlitzAsset public assetContract;
    address public owner;
    uint256 public immutable genesisEpoch;
    uint256 public constant EPOCH_DURATION = 7 days;
    uint256 public constant BASE_REWARD = 100e18; // 100 tokens per epoch base
    uint256 public constant TAP_MULTIPLIER = 10e18; // 10 extra tokens per tap

    struct Stake {
        uint256 tokenId;
        address staker;
        uint256 stakedAt;
        uint256 lastClaimEpoch;
        uint256 tapsAtStake;
    }

    mapping(uint256 => Stake) public stakes;
    mapping(address => uint256[]) public stakerTokens;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 indexed tokenId, uint256 epoch);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 epoch, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 epoch);

    constructor(address _assetContract) {
        assetContract = IMonadBlitzAsset(_assetContract);
        owner = msg.sender;
        genesisEpoch = block.timestamp;
    }

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesisEpoch) / EPOCH_DURATION;
    }

    function stake(uint256 tokenId) external {
        require(assetContract.ownerOf(tokenId) == msg.sender, "Not owner");
        require(stakes[tokenId].staker == address(0), "Already staked");

        stakes[tokenId] = Stake({
            tokenId: tokenId,
            staker: msg.sender,
            stakedAt: block.timestamp,
            lastClaimEpoch: currentEpoch(),
            tapsAtStake: assetContract.getTotalTaps(tokenId)
        });

        stakerTokens[msg.sender].push(tokenId);
        totalStaked++;

        emit Staked(msg.sender, tokenId, currentEpoch());
    }

    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        Stake storage s = stakes[tokenId];
        if (s.staker == address(0)) return 0;

        uint256 currentEpochNum = currentEpoch();
        uint256 tapsNow = assetContract.getTotalTaps(tokenId);
        uint256 newTaps = tapsNow > s.tapsAtStake ? tapsNow - s.tapsAtStake : 0;
        uint256 epochsElapsed = currentEpochNum - s.lastClaimEpoch;

        if (epochsElapsed == 0 && newTaps == 0) return 0;

        uint256 reward = epochsElapsed * BASE_REWARD + newTaps * TAP_MULTIPLIER;
        return reward;
    }

    function claimRewards(uint256 tokenId) external {
        Stake storage s = stakes[tokenId];
        require(s.staker == msg.sender, "Not staker");

        uint256 reward = calculateRewards(tokenId);
        require(reward > 0, "No rewards");

        // Update tapsAtStake to current value after counting rewards
        s.tapsAtStake = assetContract.getTotalTaps(tokenId);
        s.lastClaimEpoch = currentEpoch();

        emit RewardsClaimed(msg.sender, tokenId, reward, s.lastClaimEpoch);
    }

    function unstake(uint256 tokenId) external {
        Stake storage s = stakes[tokenId];
        require(s.staker == msg.sender, "Not staker");

        // Claim pending rewards first
        uint256 reward = calculateRewards(tokenId);
        if (reward > 0) {
            emit RewardsClaimed(msg.sender, tokenId, reward, currentEpoch());
        }

        // Remove from staker list
        address staker = s.staker;
        uint256[] storage list = stakerTokens[staker];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == tokenId) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }

        delete stakes[tokenId];
        totalStaked--;

        emit Unstaked(staker, tokenId, currentEpoch(), reward);
    }

    function getStakerTokens(address staker) external view returns (uint256[] memory) {
        return stakerTokens[staker];
    }

    function getStakeInfo(uint256 tokenId) external view returns (
        address staker,
        uint256 stakedAt,
        uint256 lastClaimEpoch,
        uint256 pendingRewards,
        uint256 tapsAtStake
    ) {
        Stake storage s = stakes[tokenId];
        return (s.staker, s.stakedAt, s.lastClaimEpoch, calculateRewards(tokenId), s.tapsAtStake);
    }
}
