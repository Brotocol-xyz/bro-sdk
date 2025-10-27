/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bridge_endpoint.json`.
 */
export type BridgeEndpoint = {
  "address": "FT6FEoPNQ9iXyR7cdwxDefLWu4MarM3ZNSVaLZTb1KZL",
  "metadata": {
    "name": "bridgeEndpoint",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "Brotocol's Anchor-based Solana program for token bridging.",
    "",
    "The system is divided into two programs, intended to work together: `bridge_registry` and `bridge_endpoint`.",
    "",
    "`bridge_endpoint` acts as the client interface.",
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
      "name": "createOrMarkOrderFinalized",
      "docs": [
        "Creates or marks and existing order as is_finalized = true.",
        "",
        "Checks that the order is not already finalized.",
        "",
        "Only callable by the owner.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount` MUST be provided and is emitted with fixed precision.",
        "- Notice that the caller can change the fields of an existing order, in which case the PDA address won't reflect them anymore."
      ],
      "discriminator": [
        26,
        227,
        251,
        220,
        223,
        212,
        245,
        18
      ],
      "accounts": [
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "bridgeRegistry"
        },
        {
          "name": "mint"
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "amount"
              },
              {
                "kind": "arg",
                "path": "recipient"
              },
              {
                "kind": "arg",
                "path": "salt"
              }
            ]
          }
        },
        {
          "name": "signer",
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
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        },
        {
          "name": "salt",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "finalizeUnwrap",
      "docs": [
        "Finalizes a non-burnable order.",
        "",
        "Transfers funds from Brotocol's hot wallet to a recipient's token account,",
        "and marks the order as finalized.",
        "",
        "Only callable by Brotocol's hot wallet.",
        "",
        "Emits a `FinalizeUnwrapEvent` event."
      ],
      "discriminator": [
        214,
        159,
        56,
        238,
        241,
        245,
        98,
        47
      ],
      "accounts": [
        {
          "name": "finalizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "bridgeRegistry"
        },
        {
          "name": "mint"
        },
        {
          "name": "finalizerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "finalizer"
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
          "name": "recipient"
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
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
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "order.amount",
                "account": "order"
              },
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "order.salt",
                "account": "order"
              }
            ]
          }
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
      "args": []
    },
    {
      "name": "getFee",
      "docs": [
        "View fn. Returns the fee for a given amount based on its token config.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount` is expected and returned with fixed precision"
      ],
      "discriminator": [
        115,
        195,
        235,
        161,
        25,
        219,
        60,
        29
      ],
      "accounts": [
        {
          "name": "mint"
        },
        {
          "name": "tokenConfig"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "returns": "u64"
    },
    {
      "name": "initialize",
      "docs": [
        "Initializes the BridgeEndpoint program by creating the BridgeEndpoint PDA.",
        "",
        "Sets the registry program address, peg-in address, and hot wallet address.",
        "",
        "Only callable by the system owner.",
        "",
        "Emits a `BridgeEndpointInitialized` event."
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
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
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
            ],
            "program": {
              "kind": "arg",
              "path": "registryProgramAddr"
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "registryProgramAddr",
          "type": "pubkey"
        },
        {
          "name": "pegInAddr",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "sendMessage",
      "docs": [
        "Sends a backend-bound message from an unknown sender.",
        "",
        "Validates that the payload is not empty and does not exceed the maximum size.",
        "",
        "Emits a `SendMessageEvent` event."
      ],
      "discriminator": [
        57,
        40,
        34,
        178,
        189,
        10,
        65,
        26
      ],
      "accounts": [
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "bridgeRegistry"
        },
        {
          "name": "sender",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "payload",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "sendMessageWithToken",
      "docs": [
        "Sends a backend-bound message from an unknown sender, alongside a token burn/transfer.",
        "",
        "Validates payload and amount, then if token is:",
        "1. Burnable: burns tokens via the registry.",
        "2. Non-burnable: transfers tokens to the peg-in address.",
        "Additionally, transfers a fee to the registry fee ATA if applicable.",
        "",
        "Emits a `SendMessageWithTokenEvent` event.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount` MUST be provided with fixed precision.",
        "- `amount` and `fee` are emitted with fixed precision."
      ],
      "discriminator": [
        58,
        102,
        189,
        178,
        196,
        125,
        177,
        43
      ],
      "accounts": [
        {
          "name": "sender",
          "writable": true,
          "signer": true
        },
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
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
            ],
            "program": {
              "kind": "account",
              "path": "bridgeRegistryProgram"
            }
          }
        },
        {
          "name": "mint",
          "writable": true
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
            ],
            "program": {
              "kind": "account",
              "path": "bridgeRegistryProgram"
            }
          }
        },
        {
          "name": "senderTokenAccount",
          "writable": true
        },
        {
          "name": "pegInAta",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "pegInAddress"
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
          "name": "pegInAddress",
          "optional": true
        },
        {
          "name": "registryFeeAta",
          "writable": true,
          "optional": true,
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
          "name": "bridgeRegistryProgram"
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
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "payload",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "setRegistryProgramAddr",
      "docs": [
        "Sets a new registry program address.",
        "",
        "Can only be called by the owner.",
        "",
        "Emits a `RegistryAddressUpdated` event."
      ],
      "discriminator": [
        57,
        92,
        85,
        169,
        125,
        30,
        136,
        249
      ],
      "accounts": [
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "bridgeRegistry"
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
          "name": "newRegistryProgAddr",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "transferToUnwrap",
      "docs": [
        "Verifies and processes a bridge order from another chain. Inits the order PDA.",
        "",
        "1. Burnable tokens: mints tokens directly to the recipient and finalizes the order.",
        "2. Non-burnable: order is left pending to be finalized later by Brotocol's hot wallet.",
        "",
        "Only callable by a RELAYER.",
        "",
        "Emits a `TransferToUnwrapEvent` event.",
        "",
        "**Developer Notes:**",
        "",
        "- `amount` MUST be provided and is emitted with fixed precision."
      ],
      "discriminator": [
        128,
        196,
        34,
        76,
        250,
        97,
        235,
        12
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
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
            ],
            "program": {
              "kind": "account",
              "path": "bridgeRegistryProgram"
            }
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
            ],
            "program": {
              "kind": "account",
              "path": "bridgeRegistryProgram"
            }
          }
        },
        {
          "name": "recipient"
        },
        {
          "name": "recipientTokenAccount",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
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
          "name": "bridgeRegistryProgram"
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "amount"
              },
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "arg",
                "path": "salt"
              }
            ]
          }
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
        },
        {
          "name": "salt",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "signatures",
          "type": {
            "vec": {
              "defined": {
                "name": "signatureData"
              }
            }
          }
        }
      ]
    },
    {
      "name": "updatePegInAddress",
      "docs": [
        "Updates the peg-in address.",
        "",
        "Can only be called by the owner.",
        "",
        "Emits a `PegInAddressUpdated` event."
      ],
      "discriminator": [
        242,
        31,
        5,
        167,
        39,
        161,
        36,
        179
      ],
      "accounts": [
        {
          "name": "bridgeEndpoint",
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
                  101,
                  110,
                  100,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "bridgeRegistry"
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
          "name": "newAddress",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bridgeEndpoint",
      "discriminator": [
        77,
        45,
        204,
        7,
        197,
        19,
        41,
        160
      ]
    },
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
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
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
      "name": "bridgeEndpointInitialized",
      "discriminator": [
        175,
        98,
        75,
        126,
        140,
        130,
        165,
        96
      ]
    },
    {
      "name": "finalizeUnwrapEvent",
      "discriminator": [
        168,
        50,
        171,
        179,
        126,
        199,
        3,
        167
      ]
    },
    {
      "name": "finalizedOrderCreated",
      "discriminator": [
        36,
        81,
        20,
        212,
        206,
        92,
        125,
        102
      ]
    },
    {
      "name": "hotWalletAddressUpdated",
      "discriminator": [
        211,
        113,
        89,
        52,
        188,
        146,
        124,
        21
      ]
    },
    {
      "name": "orderMarkedFinalized",
      "discriminator": [
        78,
        236,
        93,
        107,
        97,
        159,
        3,
        182
      ]
    },
    {
      "name": "pegInAddressUpdated",
      "discriminator": [
        153,
        159,
        188,
        73,
        155,
        112,
        95,
        134
      ]
    },
    {
      "name": "registryAddressUpdated",
      "discriminator": [
        172,
        213,
        242,
        89,
        216,
        240,
        177,
        33
      ]
    },
    {
      "name": "sendMessageEvent",
      "discriminator": [
        178,
        176,
        174,
        212,
        10,
        219,
        181,
        92
      ]
    },
    {
      "name": "sendMessageWithTokenEvent",
      "discriminator": [
        241,
        21,
        252,
        132,
        143,
        113,
        29,
        203
      ]
    },
    {
      "name": "transferToUnwrapEvent",
      "discriminator": [
        147,
        9,
        65,
        104,
        59,
        66,
        15,
        233
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
      "name": "invalidOwner",
      "msg": "Invalid owner"
    },
    {
      "code": 6002,
      "name": "overflow",
      "msg": "overflow"
    },
    {
      "code": 6003,
      "name": "notFinalizer",
      "msg": "Not finalizer"
    },
    {
      "code": 6004,
      "name": "invalidEmptyMsg",
      "msg": "Invalid empty message"
    },
    {
      "code": 6005,
      "name": "missingReqPegInAccs",
      "msg": "Missing required peg in accounts for non-burnable token"
    },
    {
      "code": 6006,
      "name": "missingRegAtaAcc",
      "msg": "Missing required registry ata account"
    },
    {
      "code": 6007,
      "name": "invalidRecipient",
      "msg": "Invalid recipient"
    },
    {
      "code": 6008,
      "name": "invalidMint",
      "msg": "Invalid mint"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6010,
      "name": "secp256k1Error",
      "msg": "Secp256k1Error - check logs"
    },
    {
      "code": 6011,
      "name": "invalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6012,
      "name": "notRelayer",
      "msg": "Sender is not a relayer"
    },
    {
      "code": 6013,
      "name": "insufficientValidators",
      "msg": "Insufficient validators"
    },
    {
      "code": 6014,
      "name": "notValidator",
      "msg": "Not validator"
    },
    {
      "code": 6015,
      "name": "mustBePausedToInitialize",
      "msg": "Must be paused to initialize endpoint"
    },
    {
      "code": 6016,
      "name": "duplicateValidator",
      "msg": "Duplicate validator"
    },
    {
      "code": 6017,
      "name": "paused",
      "msg": "Bridge is paused"
    },
    {
      "code": 6018,
      "name": "orderAlreadyFinalized",
      "msg": "Order already processed"
    },
    {
      "code": 6019,
      "name": "messageTooLarge",
      "msg": "Message too large"
    },
    {
      "code": 6020,
      "name": "missingReqRecipientTokenAcc",
      "msg": "Recipient Token Account was not provided"
    }
  ],
  "types": [
    {
      "name": "bridgeEndpoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registryProgramAddr",
            "docs": [
              "Registry program pubkey"
            ],
            "type": "pubkey"
          },
          {
            "name": "pegInAddress",
            "docs": [
              "Brotocol peg in account pubkey"
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "bridgeEndpointInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "System's owner (registry and endpoint)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bridgeEndpoint",
            "docs": [
              "Bridge endpoint PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "pegInAddress",
            "docs": [
              "Brotocol's peg in address"
            ],
            "type": "pubkey"
          }
        ]
      }
    },
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
      "name": "finalizeUnwrapEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderHash",
            "docs": [
              "order hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "finalizedOrderCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pdaAddress",
            "docs": [
              "Order address"
            ],
            "type": "pubkey"
          },
          {
            "name": "orderHash",
            "docs": [
              "order hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "salt",
            "docs": [
              "Salt (nonce) of the order"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipient",
            "docs": [
              "Authority of the recipient ATA"
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount to be bridged into Solana, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "isFinalized",
            "docs": [
              "If funds have already been minted/transferred to the recipient ATA"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "hotWalletAddressUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAddress",
            "type": "pubkey"
          },
          {
            "name": "newAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "Mint to be bridged into Solana"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount to be bridged into Solana, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "recipient",
            "docs": [
              "Authority of the recipient ATA"
            ],
            "type": "pubkey"
          },
          {
            "name": "salt",
            "docs": [
              "Salt (nonce) of the order"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isFinalized",
            "docs": [
              "If funds have already been minted/transferred to the recipient ATA"
            ],
            "type": "bool"
          },
          {
            "name": "orderHash",
            "docs": [
              "Order hash used for verification"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "orderMarkedFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pdaAddress",
            "docs": [
              "Order address"
            ],
            "type": "pubkey"
          },
          {
            "name": "orderHash",
            "docs": [
              "order hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "salt",
            "docs": [
              "Salt (nonce) of the order"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipient",
            "docs": [
              "Authority of the recipient ATA"
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount to be bridged into Solana, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "isFinalized",
            "docs": [
              "If funds have already been minted/transferred to the recipient ATA"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "pegInAddressUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAddress",
            "type": "pubkey"
          },
          {
            "name": "newAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "registryAddressUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldRegistryAddr",
            "docs": [
              "Old registry program id"
            ],
            "type": "pubkey"
          },
          {
            "name": "newRegistryAddr",
            "docs": [
              "New registry program id"
            ],
            "type": "pubkey"
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
      "name": "sendMessageEvent",
      "docs": [
        "payload may be decoded like the below (for cross order)",
        "bytes4 selector = bytes4(keccak256(\"transferToCross(address,uint256,address,uint256)\"));",
        "bytes memory encodedData = abi.encodeWithSelector(selector, destToken, destChainId, destAddress, amount);"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "docs": [
              "Sender of the message"
            ],
            "type": "pubkey"
          },
          {
            "name": "payload",
            "docs": [
              "Backend-bound message"
            ],
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "sendMessageWithTokenEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "docs": [
              "Sender"
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount sent, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "fee",
            "docs": [
              "Fee charged, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "payload",
            "docs": [
              "Backend-bound message"
            ],
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "signatureData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "validator",
            "docs": [
              "The expected 32-byte prefix of the validator's SECP256k1 public key,",
              "used for signature verification and comparison."
            ],
            "type": "pubkey"
          },
          {
            "name": "signature",
            "docs": [
              "The 64-byte ECDSA signature, composed of the concatenated `r` and `s` values."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "recoveryId",
            "docs": [
              "The recovery ID (also called `v` in Ethereum), used to recover the public key from the signature and message hash."
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
      "name": "transferToUnwrapEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderHash",
            "docs": [
              "order hash"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "salt",
            "docs": [
              "Salt (nonce) of the order"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipient",
            "docs": [
              "Authority of the recipient ATA"
            ],
            "type": "pubkey"
          },
          {
            "name": "token",
            "docs": [
              "Mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount to be bridged into Solana, in fixed decimals"
            ],
            "type": "u64"
          },
          {
            "name": "isFinalized",
            "docs": [
              "If funds have already been minted/transferred to the recipient ATA"
            ],
            "type": "bool"
          }
        ]
      }
    }
  ]
};
