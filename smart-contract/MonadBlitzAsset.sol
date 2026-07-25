// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MonadBlitzAsset {
    struct AssetInfo {
        string chipUid;
        int32 lat;
        int32 lon;
        uint64 timestamp;
        bool collateralized;
        uint16 royaltyBps;
    }

    mapping(uint256 => AssetInfo) public assets;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;

    address public minter;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event CollateralStatusChanged(uint256 indexed tokenId, bool status);
    event AssetMinted(uint256 indexed tokenId, string chipUid, int32 lat, int32 lon, uint64 timestamp);

    constructor() {
        minter = msg.sender;
    }

    function mintAsset(
        uint256 tokenId,
        string calldata chipUid,
        int32 lat,
        int32 lon,
        string calldata metadataURI
    ) external returns (uint256) {
        require(msg.sender == minter, "Not minter");
        require(_owners[tokenId] == address(0), "Exists");

        _owners[tokenId] = minter;
        _balances[minter]++;
        _tokenURIs[tokenId] = metadataURI;

        assets[tokenId] = AssetInfo({
            chipUid: chipUid,
            lat: lat,
            lon: lon,
            timestamp: uint64(block.timestamp),
            collateralized: false,
            royaltyBps: 500
        });

        totalSupply++;
        emit Transfer(address(0), minter, tokenId);
        emit AssetMinted(tokenId, chipUid, lat, lon, uint64(block.timestamp));
        return tokenId;
    }

    function getAssetGeo(uint256 tokenId) external view returns (int32 lat, int32 lon, uint64 timestamp) {
        AssetInfo storage a = assets[tokenId];
        return (a.lat, a.lon, a.timestamp);
    }

    function setCollateralStatus(uint256 tokenId, bool status) external {
        require(_owners[tokenId] == msg.sender, "Not owner");
        assets[tokenId].collateralized = status;
        emit CollateralStatusChanged(tokenId, status);
    }

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (minter, (salePrice * 5) / 100);
    }

    function transferAsset(uint256 tokenId, address to) external {
        address from = _owners[tokenId];
        require(from == msg.sender, "Not owner");
        require(to != address(0), "Zero address");

        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;
        emit Transfer(from, to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Nonexistent");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _tokenURIs[tokenId];
    }

    function isCollateralized(uint256 tokenId) external view returns (bool) {
        return assets[tokenId].collateralized;
    }
}
