/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bridge_registry.json`.
 */
export type BridgeRegistry = {
  "address": "2FSuDUk6QZioVmGQfasK5mhNkb1vt7WxDy8s7zkB5vch",
  "metadata": {
    "name": "bridgeRegistry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "Brotocol's Anchor-based Solana program for token bridging.",
    "",
    "The system is divided into two programs, intended to work together: `bridge_registry` and `bridge_endpoint`.",
    "",
    "`bridge_registry` is in charge of managing token approval, access control, fees, pause state,",
    "system configs and the minting and burning of burnable tokens.",
    "",
    "**Developer Notes:**",
    "",
    "- Both programs expect all amounts (in configs and ixs args) with fixed precision defined by",
    "`SOLANA_FIXED_PRECISION` in the `solana-globals` crate, regardless the actual number of decimals of a mint.",
    "For example, for a mint with 6 decimals, if `SOLANA_FIXED_PRECISION` is set to 9, 1 unit of such token",
    "will be represented in the system as 1_000_000_000 (1 x 10^9). The system deals with the appropriate",
    "convertions on minting, burning or transferring the actual amount.",
    "- A mint with their `mint_authority` set to the BridgeRegistry PDA is considered burnable."
  ],
  "instructions": [
    {
      "name": "burnTokens",
      "docs": [
        "Burns a specified amount of tokens from a user's ATA.",
        "",
        "Can only be called by a MINTER (which in a regular non-emergency flow,",
        "it's only the endpoint program).",
        "",
        "Emits a `BurnTokensEvent` event.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount`, MUST be provided and is emitted with fixed precision."
      ],
      "discriminator": [
        76,
        15,
        51,
        254,
        229,
        215,
        121,
        66
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "fromAta",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "ataAuth",
          "signer": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "collectAccruedFee",
      "docs": [
        "Collects accrued fees from a registry's ATA.",
        "Transfers its entire balance to an owner's ATA.",
        "",
        "Can only be called by the owner.",
        "",
        "Emits a `CollectAccruedFeeEvent` event.",
        "",
        "**Developer Notes:**:",
        "",
        "- `collect_amount` is emitted with fixed precision, regardless mint's actual decimals."
      ],
      "discriminator": [
        102,
        179,
        56,
        53,
        213,
        47,
        73,
        139
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "registryAccruedFeesAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bridgeRegistry"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ownerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "grantRole",
      "docs": [
        "Grants a role(s) to a pubkey.",
        "",
        "Can only be called by the owner.",
        "",
        "Internally calls `grant_role_internal`, which emits a `RoleUpdated` event.",
        "",
        "**Developer Notes:** Each role is represented as a distinct bit in a u8 bitmask.",
        "This allows combining multiple roles in a single value using bitwise OR.",
        "Example: a user with both VALIDATOR_ROLE and MINTER_ROLE would have a role value of `VALIDATOR_ROLE | MINTER_ROLE` (i.e., `0b00000101`)."
      ],
      "discriminator": [
        218,
        234,
        128,
        15,
        82,
        33,
        236,
        253
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": [
        {
          "name": "role",
          "type": "u8"
        },
        {
          "name": "pubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "hasRole",
      "docs": [
        "Checks if an account has a given role.",
        "",
        "Returns a boolean indicating whether the role is assigned to the pubkey."
      ],
      "discriminator": [
        218,
        136,
        44,
        87,
        142,
        247,
        141,
        195
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "role",
          "type": "u8"
        },
        {
          "name": "pubkey",
          "type": "pubkey"
        }
      ],
      "returns": "bool"
    },
    {
      "name": "initialize",
      "docs": [
        "Initializes the bridge registry program by creating the BridgeRegistry PDA.",
        "",
        "Sets the owner, initializes an empty list for roles,",
        "sets the required number of validators, and pauses the system.",
        "",
        "Emits a `BridgeRegistryInitialized` event."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "requiredValidators",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintTokens",
      "docs": [
        "Mints a specified amount of tokens to a recipient's ATA.",
        "",
        "Can only be called by a MINTER (which in a regular non-emergency flow,",
        "it's only the endpoint program).",
        "",
        "Emits a `MintTokensEvent` event.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount`, MUST be provided and is emitted with fixed precision."
      ],
      "discriminator": [
        59,
        132,
        24,
        246,
        122,
        39,
        8,
        243
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "ataAuth"
        },
        {
          "name": "recipientAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ataAuth"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pause",
      "docs": [
        "Pauses the bridge registry, preventing certain operations.",
        "",
        "Only callable by the owner.",
        "",
        "Emits a `PauseStateChanged` event."
      ],
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "revokeRole",
      "docs": [
        "Revokes a role(s) from a pubkey.",
        "",
        "Can only be called by the owner.",
        "",
        "Internally calls `revoke_role_internal`, which emits a `RoleUpdated` event`."
      ],
      "discriminator": [
        179,
        232,
        2,
        180,
        48,
        227,
        82,
        7
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": [
        {
          "name": "role",
          "type": "u8"
        },
        {
          "name": "pubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setApprovedToken",
      "docs": [
        "Creates or modifies a TokenConfig account.",
        "",
        "Only callable by the owner.",
        "",
        "Emits a `SetApprovedTokenEvent` event.",
        "",
        "**Developer Notes:**",
        "",
        "- `fee_pct`, `min_fee`, `min_amount` and `max_amount` MUST be provided with fixed precision.",
        "- Notice that these values are stored with fixed precision. Proper transformations",
        "are executed on minting, burning or transferring.",
        "- A mint is considered approved if its TokenConfig account exists. `unset_token` closes the account.",
        "A `TokenNotApproved` error should be therefore handled from client code when the account does not exist."
      ],
      "discriminator": [
        165,
        10,
        94,
        163,
        87,
        170,
        206,
        190
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feePct",
          "type": "u64"
        },
        {
          "name": "minFee",
          "type": "u64"
        },
        {
          "name": "minAmount",
          "type": "u64"
        },
        {
          "name": "maxAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setRequiredValidators",
      "docs": [
        "Sets a new required number of validators.",
        "",
        "Can only be called by the owner.",
        "",
        "Emits a `SetRequiredValidatorsEvent` event."
      ],
      "discriminator": [
        172,
        244,
        180,
        153,
        228,
        80,
        161,
        111
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": [
        {
          "name": "requiredValidators",
          "type": "u8"
        }
      ]
    },
    {
      "name": "transferMintAuthority",
      "docs": [
        "Transfers the mint authority of a token from the registry to a new authority.",
        "",
        "Only callable by the owner.",
        "",
        "Emits a `MintAuthorityTransferred` event."
      ],
      "discriminator": [
        87,
        237,
        187,
        84,
        168,
        175,
        241,
        75
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "transferOwnership",
      "docs": [
        "Transfers ownership of the bridge registry to a new owner.",
        "",
        "Only callable by the current owner.",
        "",
        "Emits a `OwnershipTransferred` event."
      ],
      "discriminator": [
        65,
        177,
        215,
        73,
        53,
        45,
        99,
        47
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unpause",
      "docs": [
        "Unpauses the bridge registry, allowing operations to resume.",
        "",
        "Only callable by the owner.",
        "",
        "Emits a `PauseStateChanged` event."
      ],
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "unsetToken",
      "docs": [
        "Unsets a token by closing its TokenConfig account.",
        "",
        "Only callable by the owner.",
        "",
        "Emits an `UnsetTokenEvent` event."
      ],
      "discriminator": [
        97,
        42,
        37,
        185,
        1,
        79,
        26,
        46
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "bridgeRegistry"
          ]
        },
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenConfig",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bridgeRegistry",
      "discriminator": [
        178,
        207,
        65,
        53,
        51,
        157,
        148,
        202
      ]
    },
    {
      "name": "tokenConfigAccount",
      "discriminator": [
        18,
        52,
        4,
        120,
        180,
        238,
        187,
        250
      ]
    }
  ],
  "events": [
    {
      "name": "bridgeRegistryInitialized",
      "discriminator": [
        212,
        42,
        194,
        169,
        153,
        14,
        116,
        106
      ]
    },
    {
      "name": "burnTokensEvent",
      "discriminator": [
        109,
        11,
        212,
        62,
        99,
        137,
        69,
        115
      ]
    },
    {
      "name": "collectAccruedFeeEvent",
      "discriminator": [
        235,
        117,
        65,
        236,
        94,
        245,
        79,
        93
      ]
    },
    {
      "name": "mintAuthorityTransferred",
      "discriminator": [
        23,
        136,
        155,
        223,
        27,
        166,
        51,
        85
      ]
    },
    {
      "name": "mintTokensEvent",
      "discriminator": [
        100,
        103,
        14,
        237,
        95,
        8,
        40,
        143
      ]
    },
    {
      "name": "ownershipTransferred",
      "discriminator": [
        172,
        61,
        205,
        183,
        250,
        50,
        38,
        98
      ]
    },
    {
      "name": "pauseStateChanged",
      "discriminator": [
        224,
        2,
        23,
        9,
        225,
        156,
        4,
        72
      ]
    },
    {
      "name": "roleUpdated",
      "discriminator": [
        155,
        222,
        44,
        187,
        5,
        65,
        10,
        212
      ]
    },
    {
      "name": "setApprovedTokenEvent",
      "discriminator": [
        120,
        202,
        237,
        217,
        91,
        97,
        185,
        58
      ]
    },
    {
      "name": "setRequiredValidatorsEvent",
      "discriminator": [
        241,
        73,
        24,
        234,
        189,
        215,
        147,
        36
      ]
    },
    {
      "name": "unsetTokenEvent",
      "discriminator": [
        48,
        219,
        144,
        246,
        69,
        91,
        208,
        210
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notAuthorized",
      "msg": "Not authorized to perform this action"
    },
    {
      "code": 6001,
      "name": "minMustBeLteMax",
      "msg": "Min amount must be less than or equal to max"
    },
    {
      "code": 6002,
      "name": "invalidFee",
      "msg": "Invalid fee"
    },
    {
      "code": 6003,
      "name": "minFeeMustBeLteMin",
      "msg": "Min fee must be less than or equal to min amount"
    },
    {
      "code": 6004,
      "name": "noAccruedFees",
      "msg": "No accrued fees for this mint"
    },
    {
      "code": 6005,
      "name": "invalidDecimals",
      "msg": "Max supported decimals: 9"
    },
    {
      "code": 6006,
      "name": "roleAlreadyGranted",
      "msg": "Role already granted"
    },
    {
      "code": 6007,
      "name": "roleNotFound",
      "msg": "Role not found"
    },
    {
      "code": 6008,
      "name": "invalidRequiredValidators",
      "msg": "Invalid required validators"
    },
    {
      "code": 6009,
      "name": "maxRolesReached",
      "msg": "Maximum number of roles reached"
    },
    {
      "code": 6010,
      "name": "unauthorizedMinter",
      "msg": "Not authorized to mint tokens"
    },
    {
      "code": 6011,
      "name": "alreadyPaused",
      "msg": "Already paused"
    },
    {
      "code": 6012,
      "name": "notPaused",
      "msg": "Not paused"
    },
    {
      "code": 6013,
      "name": "paused",
      "msg": "Bridge paused"
    }
  ],
  "types": [
    {
      "name": "bridgeRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Owner of the system (registry and endpoint)"
            ],
            "type": "pubkey"
          },
          {
            "name": "roles",
            "docs": [
              "Access control roles as bitmasks (see Constants)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "roleEntry"
                }
              }
            }
          },
          {
            "name": "requiredValidators",
            "docs": [
              "Threshold of valid signatures needed to process an order on `transfer_to_unwrap`"
            ],
            "type": "u8"
          },
          {
            "name": "isPaused",
            "docs": [
              "Pause status of the system (registry and endpoint)"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "bridgeRegistryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bridgeRegistry",
            "docs": [
              "Bridge registry PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "System owner (registry and endpoint)"
            ],
            "type": "pubkey"
          },
          {
            "name": "requiredValidators",
            "docs": [
              "Threshold of valid signatures needed to process an order on `transfer_to_unwrap` set"
            ],
            "type": "u8"
          },
          {
            "name": "isPaused",
            "docs": [
              "Pause status"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "burnTokensEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenAccount",
            "docs": [
              "Burned from"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount burned, in fixed precision"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "collectAccruedFeeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "collectAmount",
            "docs": [
              "Amount collected, in fixed precision"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "mintAuthorityTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "docs": [
              "New mint authority"
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mintTokensEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenAccount",
            "docs": [
              "Minted to"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount minted, in fixed precision"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ownershipTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previousOwner",
            "type": "pubkey"
          },
          {
            "name": "newOwner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "pauseStateChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "docs": [
              "Pause status of the system"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "roleEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "account",
            "docs": [
              "Pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "role",
            "docs": [
              "Bitmask role (can be more than one, see Constants)"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roleUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "account",
            "docs": [
              "Pubkey that changed its role(s)"
            ],
            "type": "pubkey"
          },
          {
            "name": "role",
            "docs": [
              "Role(s) granted or revoked, as bitmask (see Constants)"
            ],
            "type": "u8"
          },
          {
            "name": "granted",
            "docs": [
              "If the roles(s) was granted or revoked"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "setApprovedTokenEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "burnable",
            "docs": [
              "If registry is the mint authority (may change)"
            ],
            "type": "bool"
          },
          {
            "name": "feePct",
            "docs": [
              "Fee percentage charged on `send_message_with_token`.",
              "In fixed precision (i.e. 100% = 10 ^ SOLANA_FIXED_PRECISION)"
            ],
            "type": "u64"
          },
          {
            "name": "minFee",
            "docs": [
              "Minimum fee to be charged on `send_message_with_token` if actual `fee_pct` is less than this.",
              "In fixed precision"
            ],
            "type": "u64"
          },
          {
            "name": "minAmount",
            "docs": [
              "Minimum amount allowed on `send_message_with_token`",
              "In fixed precision"
            ],
            "type": "u64"
          },
          {
            "name": "maxAmount",
            "docs": [
              "Maximum amount allowed on `send_message_with_token`",
              "In fixed precision"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "setRequiredValidatorsEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requiredValidators",
            "docs": [
              "Threshold of valid signatures needed to process an order on `transfer_to_unwrap` set"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenConfigAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "docs": [
              "Mint pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "feePct",
            "docs": [
              "Percentage charged on `send_message_with_token`.",
              "In fixed precision (i.e. 100% = 10 ^ SOLANA_FIXED_PRECISION)"
            ],
            "type": "u64"
          },
          {
            "name": "minFee",
            "docs": [
              "Minimum fee to be charged on `send_message_with_token` if actual `fee_pct` is less than this.",
              "In fixed precision"
            ],
            "type": "u64"
          },
          {
            "name": "minAmount",
            "docs": [
              "Minimum amount allowed on `send_message_with_token`",
              "In fixed precision"
            ],
            "type": "u64"
          },
          {
            "name": "maxAmount",
            "docs": [
              "Maximum amount allowed on `send_message_with_token`",
              "In fixed precision"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unsetTokenEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
