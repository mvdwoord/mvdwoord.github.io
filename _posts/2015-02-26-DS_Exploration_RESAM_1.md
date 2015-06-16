---
layout: post
title: Datastore exploration in RES Automation Manager – Part 1
category: exploration
tags:
- T-SQL
- RES Automation Manager
- XML
---
Working with RES Automation Manager (AM) you may have experienced some limitations in extracting information about your environment. There is some built-in functionality to generate an “instant report” for some components, but this creates a heavily formatted document, not structured data.

Everything is stored in the Datastore, implemented in an RDBMS such as MS-SQL, DB2, or other (although I have only ever seen these two in production environments). Can we query this directly to reveal some more about the AM environment, and get this data in a format that is structured, for further processing?

<!-- more -->

Before we continue, the official stance of RES software is to never peek, let alone poke in the database. Everything should be done through either the console (GUI / CLI) or the WebAPI. There are however plenty of examples where there is simply no other way than to ‘pop the hood’ and DIY.. sometimes it is even their own advice, be it with assistance from their engineers. This will be the only and last disclaimer on this topic. Use any and all information provided here at your own risk.

Back to business, we wanted to generate some reports about the agents and their properties. Most of these are stored directly in the tblAgents table such as:

| COLUMN         | DESCRIPTION                                                                                                         |
|----------------|---------------------------------------------------------------------------------------------------------------------|
| strName        | This is as you would expect, the common name of the agent as used throughout the application                        |
| WUIDAgent      | Many objects are internally represented with a GUID like identifier, this is the one uniquely identifying an agent. |
| lngStatus      | This indicates an agent’s connectivity status. Value can be 1 (online) or 0 (offline).                              |
| dtmLastContact | This DateTime field holds a timestamp of the last time the agent has contacted the AM environment.                  |
| strOSName      | The name of the operating system of the agent. E.g. “Microsoft Windows Server 2012 R2 Standard”                     |

So far so good, but in our environment we use rules to manage certain team memberships and one of these rules is to match the ‘First Contacted Dispatcher’. This is the dispatcher the agent initially contacted upon registering in the environment and can be of great help in identifying the location or BU the machine belongs to. So I expected this value to be stored alongside the rest of the information in the Agents table; unfortunately there is only a column named strLastDispatcher which seems to hold the WUID for the most recently contacted dispatcher.

Upon some inspection with a SQL profiler, while clicking about in the GUI I noticed the imgInfo field is queried whenever the console processes a rule which filters on the ‘first accessed dispatcher’. The column type for imgInfo is ‘image’ which is defined as ‘Variable-length binary data’. Furthermore this datatype is for ‘storing large non-Unicode and Unicode character and binary data. Unicode data uses the UNICODE UCS-2 character set’. Let’s see what it looks like:

