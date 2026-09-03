# Qubership APIHUB Extension
1. [Overview](#overview)
2. [Usage](#usage)
3. [Configuration file](#configuration-file)

## Overview
Qubership APIHUB extension allows you to publish API specifications or other API-related documents from a local folder to [APIHUB](https://github.com/Netcracker/qubership-apihub-ui).

<img src="/docs/img/qubership-apihub-extension.png" width="388" height="690">

## Usage
After installing the extension, open a folder and navigate to Qubership APIHUB extension, which is shown in the Activity Bar. If your root folder contains at least one OpenAPI or GraphQL specification, you will see it in the "Documents to Publish" section. Specifications from subfolders will also be shown.

***Notes:*** 
1. OpenAPI specification is file that meets one of the following conditions:
   -  ```.yaml```/```.yml``` file that has "openapi" entry
   -  ```.json``` file that has "openapi" entry
2. GraphQL specification is file that meets one of the following conditions:
   - ```.graphql```/```.gql``` file  


Select the files you need to publish. If you need to publish files other than OpenAPI or GraphQL specifications - such as PDF, Markdown or DOC files - you can extend list of files for publications via the [configuration file](#configuration-file). 	

Along with file selection, specify the following information:
1. APIHUB environment:
    * **APIHUB URL** - URL to APIHUB server where you will publish documents. The value is stored in the extension settings and will be reused across different folders and workspaces, so you will not need to enter it again.
    * **Authentication Token** - your personal access token issued in APIHUB. For details, please see the [APIHUB Portal user guide](https://github.com/Netcracker/qubership-apihub-ui/blob/main/docs/Portal%20User%20Guide.md#personal-access-tokens).
2. Publish to APIHUB:
    * **Package Id** - package where you need to publish your files. All selected files from the currently open root folder will be published in this package.
    * **Version** - version of the package.
    * **Status** - status of the package version.
    * **Labels** - any additional information, multiple values can be specified.
    * **Previous Release Version** - previous version for the being published version.

After selecting the files and filling in all the required fields, click the **Publish** button. The status bar will indicate the progress of the publication, and once it is complete, a notification will be displayed.

If your OpenAPI specification contains [remote references](https://swagger.io/docs/specification/v3_0/using-ref/) to other files, the extension will automatically gather all referenced files (if they are available in the current root folder) and include them in the publication. APIHUB merges these referenced files with the main OpenAPI specification file, converting external references into local ones.

If you are working with multi-root workspace, you need to publish files from each root folder separately. Each root folder will be associated with a different package id and have its own [configuration file](#configuration-file).

## Configuration file
Configuration file is file where APIHUB extension stores publication-related information. It is ```yaml``` file named ```.apihub-config.yaml```, located in the root folder.  
Configuration file contains the following information:

| Field     | Type             | Description    |
| --------- | ---------------- | -------------- |
| version   | string           | Version of configuration file. Currently, only version "1.0" is available. |
| packageId | string           | Package where files will be published.|
| files     | [string]         | List of files that will be published. You can add path to any file from your folder. Such file will be added to the "Documents to Publish" section of the extension.|  

Example of configuration file:
```yaml
version: 1.0
packageId: WS.GRP.PCKG1
files: 
    - src/docs/pet.yaml
    - src/docs/shop.graphql
    - src/docs/readMe.md
```
The configuration file is automatically created after your first publication and updated with each subsequent publication. It stores packageId of published version and list of files (paths to the files) that were published. The next time you use the extension, these documents will be pre-selected and the package id will be pre-filled in the extension.

You can add APIHUB configuration file to source control system to share it with other people working with the same source control repository.

If your open folder does not have a configuration file but you need to extend the list of files to publish, you can manually create it following the specified format.
