// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MonadBlitzAsset {
    // ═══ STRUCTS ═══

    struct GeoPoint {
        int32 lat;
        int32 lon;
        uint64 timestamp;
    }

    struct AssetInfo {
        string chipUid;
        int32 currentLat;
        int32 currentLon;
        uint64 lastTapTimestamp;
        bool collateralized;
        uint16 royaltyBps;
        uint256 totalTaps;
    }

    struct OwnershipRecord {
        address owner;
        uint64 timestamp;
    }

    // ═══ STORAGE ═══

    mapping(uint256 => AssetInfo) public assets;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => GeoPoint[]) private _geoHistory;
    mapping(uint256 => OwnershipRecord[]) private _ownershipHistory;

    address public minter;
    uint256 public totalSupply;

    // Velocity lock constants
    uint256 public constant MAX_VELOCITY_MPS = 138; // ~500 km/h
    uint256 private constant EARTH_RADIUS_M = 6371000;
    uint256 private constant MICRODEGREE_SCALE = 1e6;

    // ═══ EVENTS ═══

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event CollateralStatusChanged(uint256 indexed tokenId, bool status);
    event AssetMinted(uint256 indexed tokenId, string chipUid, int32 lat, int32 lon, uint64 timestamp);
    event TapRecorded(uint256 indexed tokenId, int32 lat, int32 lon, uint64 timestamp, uint256 totalTaps);
    event VelocityCheckFailed(uint256 indexed tokenId, uint256 velocityMps, uint256 maxAllowed);

    // ═══ CONSTRUCTOR ═══

    constructor() {
        minter = msg.sender;
    }

    // ═══ MINT ═══

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


        assets[tokenId] = AssetInfo({
            chipUid: chipUid,
            currentLat: lat,
            currentLon: lon,
            lastTapTimestamp: uint64(block.timestamp),
            collateralized: false,
            royaltyBps: 500,
            totalTaps: 1
        });

        _geoHistory[tokenId].push(GeoPoint(lat, lon, uint64(block.timestamp)));
        _ownershipHistory[tokenId].push(OwnershipRecord(minter, uint64(block.timestamp)));

        totalSupply++;
        emit Transfer(address(0), minter, tokenId);
        emit AssetMinted(tokenId, chipUid, lat, lon, uint64(block.timestamp));
        emit TapRecorded(tokenId, lat, lon, uint64(block.timestamp), 1);
        return tokenId;
    }

    // ═══ TAP (GEO UPDATE) — verifiable physical possession ═══

    function recordTap(uint256 tokenId, int32 lat, int32 lon) external returns (bool) {
        require(_owners[tokenId] == msg.sender, "Not owner");
        require(lat >= -90000000 && lat <= 90000000, "Invalid lat");
        require(lon >= -180000000 && lon <= 180000000, "Invalid lon");

        AssetInfo storage asset = assets[tokenId];

        // Velocity check: reject impossible travel between taps
        if (asset.totalTaps > 0 && asset.lastTapTimestamp > 0) {
            uint256 distanceM = _haversineDistance(asset.currentLat, asset.currentLon, lat, lon);
            uint256 timeDiff = block.timestamp - asset.lastTapTimestamp;

            if (timeDiff > 0) {
                uint256 velocityMps = (distanceM * 1e6) / (timeDiff * 1e6); // m/s
                if (velocityMps > MAX_VELOCITY_MPS * 1e6 / 1e6) {
                    uint256 actual = distanceM / timeDiff;
                    if (actual > MAX_VELOCITY_MPS) {
                        emit VelocityCheckFailed(tokenId, actual, MAX_VELOCITY_MPS);
                        return false;
                    }
                }
            }
        }

        // Update current location
        asset.currentLat = lat;
        asset.currentLon = lon;
        asset.lastTapTimestamp = uint64(block.timestamp);
        asset.totalTaps++;

        // Append to permanent geo history
        _geoHistory[tokenId].push(GeoPoint(lat, lon, uint64(block.timestamp)));

        emit TapRecorded(tokenId, lat, lon, uint64(block.timestamp), asset.totalTaps);
        return true;
    }

    // ═══ GEO HISTORY ═══

    function getGeoHistory(uint256 tokenId) external view returns (GeoPoint[] memory) {
        return _geoHistory[tokenId];
    }

    function getGeoHistoryCount(uint256 tokenId) external view returns (uint256) {
        return _geoHistory[tokenId].length;
    }

    // ═══ OWNERSHIP PROVENANCE ═══

    function getOwnershipHistory(uint256 tokenId) external view returns (OwnershipRecord[] memory) {
        return _ownershipHistory[tokenId];
    }

    // ═══ TRANSFER WITH PROVENANCE ═══

    function transferAsset(uint256 tokenId, address to) external {
        address from = _owners[tokenId];
        require(from == msg.sender, "Not owner");
        require(to != address(0), "Zero address");

        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;

        // Record ownership change in provenance
        _ownershipHistory[tokenId].push(OwnershipRecord(to, uint64(block.timestamp)));

        emit Transfer(from, to, tokenId);
    }

    // ═══ COLLATERAL ═══

    function setCollateralStatus(uint256 tokenId, bool status) external {
        require(_owners[tokenId] == msg.sender, "Not owner");
        assets[tokenId].collateralized = status;
        emit CollateralStatusChanged(tokenId, status);
    }

    // ═══ ROYALTY ═══

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (minter, (salePrice * 5) / 100);
    }

    // ═══ VIEWS ═══

    function getCurrentGeo(uint256 tokenId) external view returns (int32 lat, int32 lon, uint64 timestamp, uint256 totalTaps) {
        AssetInfo storage a = assets[tokenId];
        return (a.currentLat, a.currentLon, a.lastTapTimestamp, a.totalTaps);
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

    function getTotalTaps(uint256 tokenId) external view returns (uint256) {
        return assets[tokenId].totalTaps;
    }

    // ═══ INTERNAL: HAVERSINE DISTANCE ═══

    function _haversineDistance(int32 lat1, int32 lon1, int32 lat2, int32 lon2) internal pure returns (uint256) {
        // Approximate: 1 microdegree ≈ 0.111319 meters at equator
        // Using Euclidean approximation for gas efficiency (sufficient for anti-spoofing)
        int256 dLat = int256(lat2) - int256(lat1);
        int256 dLon = int256(lon2) - int256(lon1);
        uint256 dLatM = uint256(dLat < 0 ? -dLat : dLat) * 111319 / uint256(MICRODEGREE_SCALE);
        uint256 dLonM = uint256(dLon < 0 ? -dLon : dLon) * 111319 / uint256(MICRODEGREE_SCALE);
        return _sqrt(dLatM * dLatM + dLonM * dLonM);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
