//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IParcel {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function mint(
        address _to,
        uint256 _tokenId,
        int16 x1,
        int16 y1,
        int16 z1,
        int16 x2,
        int16 y2,
        int16 z2
    ) external;

    function getBoundingBox(uint256 _tokenId)
        external
        view
        returns (
            int16,
            int16,
            int16,
            int16,
            int16,
            int16
        );
}

contract ParcelMigrator is Ownable, Pausable, BaseRelayRecipient {
    using Strings for uint256;
    /// BoundingBox of the parcel
    struct BoundingBox {
        int16 x1;
        int16 y1;
        int16 z1;
        int16 x2;
        int16 y2;
        int16 z2;
    }
    // OpenGSN versionRecipient
    string public override versionRecipient = "2.2.5";

    /// @dev old parcel contract implementation
    address private _oldImpl;
    /// @dev new parcel contract implementation
    address private _newImpl;
    uint256 public count;
    /**
     * Constructor
     * @param _forwarder is a trusted forwarder to allow Cryptovoxels to pay for the gas-fees.
     * @param _old old parcel contract implementation
     * @param _new old parcel contract implementation
     */
    constructor(
        address _old,
        address _new,
        address _forwarder
    ) {
        _oldImpl = _old;
        _newImpl = _new;
        _setTrustedForwarder(_forwarder);
    }

    function increaseCount() public{
        count += 1;
    }

    /**
     * @notice Checks if caller approved this migrator to transfer his old parcels
     * @dev _oldImplementation needs to be set.
     * @return boolean
     */
    function isApproved() public view returns (bool) {
        return IERC721(_oldImpl).isApprovedForAll(_msgSender(), address(this));
    }

    /**
     * @notice Migrate the list of parcels (by token Id) to the new smart contract
     * @dev Iterate through the list of parcels, checks ownership of the given tokenId and calls transferMint()
     * @param _tokenIds list of token Ids to migrate
     */
    function migrate(uint256[] calldata _tokenIds) public whenNotPaused {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _id = _tokenIds[i];
            require(
                IERC721(_oldImpl).ownerOf(_id) == _msgSender(),
                string(abi.encodePacked("You dont own parcel ", _id.toString()))
            );
            transferAndMint(_id);
        }
    }

    /// @dev Allow paymaster to pay for the gas-fees
    /// see https://docs.opengsn.org/contracts/#install-opengsn-contracts
    function _msgSender()
        internal
        view
        override(Context, BaseRelayRecipient)
        returns (address ret)
    {
        return BaseRelayRecipient._msgSender();
    }

    /// @dev Allow paymaster to pay for the gas-fees
    /// see https://docs.opengsn.org/contracts/#install-opengsn-contracts
    function _msgData()
        internal
        view
        override(Context, BaseRelayRecipient)
        returns (bytes calldata ret)
    {
        return BaseRelayRecipient._msgData();
    }

    /**
     * @notice Transfers the old parcel to the old parcel contract owner and mints a new parcel on the new parcel contract.
     * @dev For this method to work, the Migrator contract needs to be set as owner of the new Parcel contract;
     */
    function transferAndMint(uint256 _id) internal {
        (int16 x1, int16 y1, int16 z1, int16 x2, int16 y2, int16 z2) = IParcel(
            _oldImpl
        ).getBoundingBox(_id);

        IParcel(_oldImpl).safeTransferFrom(_msgSender(), owner(), _id);
        IParcel(_newImpl).mint(_msgSender(), _id, x1, y1, z1, x2, y2, z2);
    }

    /**
     * @notice Tells us if parcel has been migrated
     * @dev We know `ownerOf` will revert if the token doesn't exist; and we know the owner of a parcel can't be the Zero address, so we use ownerOf as a proxy.
     * @param _tokenId a parcel's token id
     */
    function migrated(uint256 _tokenId) public view returns (bool) {
       try IERC721(_newImpl).ownerOf(_tokenId) returns (address _owner){
           return _owner != address(0);
       }catch{
           return false;
       }
    }
}
