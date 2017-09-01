// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as os  from 'os';
import * as path from 'path';
import * as ts from 'typescript';
import { JsonFile, JsonSchema, IJsonSchemaErrorInfo } from '@microsoft/node-core-library';

import Extractor from '../Extractor';
import AstStructuredType from '../ast/AstStructuredType';
import AstEnum from '../ast/AstEnum';
import AstEnumValue from '../ast/AstEnumValue';
import AstFunction from '../ast/AstFunction';
import AstItem, { AstItemKind } from '../ast/AstItem';
import AstItemVisitor from './AstItemVisitor';
import AstPackage from '../ast/AstPackage';
import AstParameter from '../ast/AstParameter';
import AstProperty from '../ast/AstProperty';
import AstMember, { ApiAccessModifier } from '../ast/AstMember';
import AstNamespace from '../ast/AstNamespace';
import AstModuleVariable from '../ast/AstModuleVariable';
import AstMethod from '../ast/AstMethod';
import { ReleaseTag } from '../aedoc/ReleaseTag';
import { IApiReturnValue, IApiParameter } from '../api/ApiItem';
import ApiJsonFile from '../api/ApiJsonFile';

/**
 * For a library such as "example-package", ApiFileGenerator generates the "example-package.api.json"
 * file which represents the API surface for that package.  This file should be published as part
 * of the library's NPM package.  API Extractor will read this file later when it is analyzing
 * another project that consumes the library.  (Otherwise, API Extractor would have to re-analyze all
 * the *.d.ts files, which would be bad because the compiler definitions might not be available for
 * a published package, or the results of the analysis might be different somehow.)  Documentation
 * tools such as api-documenter can also use the *.api.json files.
 *
 * @public
 */
export default class ApiJsonGenerator extends AstItemVisitor {
  private static _methodCounter: number = 0;
  private static _MEMBERS_KEY: string = 'members';
  private static _EXPORTS_KEY: string = 'exports';
  private static _jsonSchema: JsonSchema | undefined = undefined;

  /**
   * The JSON schema for the *.api.json file format.
   */
  public static get jsonSchema(): JsonSchema {
    if (!ApiJsonGenerator._jsonSchema) {
      ApiJsonGenerator._jsonSchema = JsonSchema.fromFile(path.join(__dirname, '../api/api-json.schema.json'));
    }

    return ApiJsonGenerator._jsonSchema;
  }

  protected jsonOutput: Object = {};

  public writeJsonFile(reportFilename: string, extractor: Extractor): void {
    this.visit(extractor.package, this.jsonOutput);

    // Write the output before validating the schema, so we can debug it
    JsonFile.save(this.jsonOutput, reportFilename);

    // Validate that the output conforms to our JSON schema
    ApiJsonGenerator.jsonSchema.validateObjectWithCallback(this.jsonOutput, (errorInfo: IJsonSchemaErrorInfo) => {
      const errorMessage: string = path.basename(reportFilename)
        + ` does not conform to the expected schema -- please report this API Extractor bug:`
        + os.EOL + errorInfo.details;

      console.log(os.EOL + 'ERROR: ' + errorMessage + os.EOL + os.EOL);
      throw new Error(errorMessage);
    });
  }

  // @override
  protected visit(astItem: AstItem, refObject?: Object): void {
    switch (astItem.documentation.releaseTag) {
      case ReleaseTag.None:
      case ReleaseTag.Beta:
      case ReleaseTag.Public:
        break;
      default:
        return; // skip @alpha and @internal definitions
    }

    super.visit(astItem, refObject);
  }

  protected visitAstStructuredType(astStructuredType: AstStructuredType, refObject?: Object): void {
    if (!astStructuredType.supportedName) {
      return;
    }

    const kind: string =
      astStructuredType.kind === AstItemKind.Class ? ApiJsonFile.convertKindToJson(AstItemKind.Class) :
      astStructuredType.kind === AstItemKind.Interface ?
        ApiJsonFile.convertKindToJson(AstItemKind.Interface) : '';

    const structureNode: Object = {
      kind: kind,
      extends: astStructuredType.extends || '',
      implements: astStructuredType.implements || '',
      typeParameters: astStructuredType.typeParameters || [],
      deprecatedMessage: astStructuredType.documentation.deprecatedMessage || [],
      summary: astStructuredType.documentation.summary || [],
      remarks: astStructuredType.documentation.remarks || [],
      isBeta: astStructuredType.documentation.releaseTag === ReleaseTag.Beta
    };
    refObject[astStructuredType.name] = structureNode;

    ApiJsonGenerator._methodCounter = 0;

    const members: AstItem[] = astStructuredType.getSortedMemberItems();

    if (members && members.length) {
      const membersNode: Object = {};
      structureNode[ApiJsonGenerator._MEMBERS_KEY] = membersNode;

      for (const astItem of members) {
        this.visit(astItem, membersNode);
      }
    }
  }

  protected visitAstEnum(astEnum: AstEnum, refObject?: Object): void {
    if (!astEnum.supportedName) {
      return;
    }

    const valuesNode: Object = {};
    const enumNode: Object = {
      kind: ApiJsonFile.convertKindToJson(astEnum.kind),
      values: valuesNode,
      deprecatedMessage: astEnum.documentation.deprecatedMessage || [],
      summary: astEnum.documentation.summary || [],
      remarks: astEnum.documentation.remarks || [],
      isBeta: astEnum.documentation.releaseTag === ReleaseTag.Beta
    };
    refObject[astEnum.name] = enumNode;

    for (const astItem of astEnum.getSortedMemberItems()) {
      this.visit(astItem, valuesNode);
    }
  }

  protected visitAstEnumValue(astEnumValue: AstEnumValue, refObject?: Object): void {
    if (!astEnumValue.supportedName) {
      return;
    }

    const declaration: ts.Declaration = astEnumValue.getDeclaration();
    const firstToken: ts.Node = declaration ? declaration.getFirstToken() : undefined;
    const lastToken: ts.Node = declaration ? declaration.getLastToken() : undefined;

    const value: string = lastToken && lastToken !== firstToken ? lastToken.getText() : '';

    refObject[astEnumValue.name] = {
      kind: ApiJsonFile.convertKindToJson(astEnumValue.kind),
      value: value,
      deprecatedMessage: astEnumValue.documentation.deprecatedMessage || [],
      summary: astEnumValue.documentation.summary || [],
      remarks: astEnumValue.documentation.remarks || [],
      isBeta: astEnumValue.documentation.releaseTag === ReleaseTag.Beta
    };
  }

  protected visitAstFunction(astFunction: AstFunction, refObject?: Object): void {
    if (!astFunction.supportedName) {
      return;
    }

    for (const param of astFunction.params) {
      this.visitApiParam(param, astFunction.documentation.parameters[param.name]);
    }
    const returnValueNode: IApiReturnValue = {
      type: astFunction.returnType,
      description: astFunction.documentation.returnsMessage
    };

    const newNode: Object = {
      kind: ApiJsonFile.convertKindToJson(astFunction.kind),
      returnValue: returnValueNode,
      parameters: astFunction.documentation.parameters,
      deprecatedMessage: astFunction.documentation.deprecatedMessage || [],
      summary: astFunction.documentation.summary || [],
      remarks: astFunction.documentation.remarks || [],
      isBeta: astFunction.documentation.releaseTag === ReleaseTag.Beta
    };

    refObject[astFunction.name] = newNode;
  }

  protected visitAstPackage(astPackage: AstPackage, refObject?: Object): void {
    /* tslint:disable:no-string-literal */
    refObject['kind'] = ApiJsonFile.convertKindToJson(astPackage.kind);
    refObject['summary'] = astPackage.documentation.summary;
    refObject['remarks'] = astPackage.documentation.remarks;
    /* tslint:enable:no-string-literal */

    const membersNode: Object = {};
    refObject[ApiJsonGenerator._EXPORTS_KEY] = membersNode;

    for (const astItem of astPackage.getSortedMemberItems()) {
      this.visit(astItem, membersNode);
    }
  }

  protected visitAstNamespace(astNamespace: AstNamespace, refObject?: Object): void {
    if (!astNamespace.supportedName) {
      return;
    }

    const membersNode: Object = {};
    for (const astItem of astNamespace.getSortedMemberItems()) {
      this.visit(astItem, membersNode);
    }

    const newNode: Object = {
      kind: ApiJsonFile.convertKindToJson(astNamespace.kind),
      deprecatedMessage: astNamespace.documentation.deprecatedMessage || [],
      summary: astNamespace.documentation.summary || [],
      remarks: astNamespace.documentation.remarks || [],
      isBeta: astNamespace.documentation.releaseTag === ReleaseTag.Beta,
      exports: membersNode
    };

    refObject[astNamespace.name] = newNode;
  }

  protected visitAstMember(astMember: AstMember, refObject?: Object): void {
    if (!astMember.supportedName) {
      return;
    }

    refObject[astMember.name] = 'astMember-' + astMember.getDeclaration().kind;
  }

  protected visitAstProperty(astProperty: AstProperty, refObject?: Object): void {
    if (!astProperty.supportedName) {
      return;
    }

    if (astProperty.getDeclaration().kind === ts.SyntaxKind.SetAccessor) {
      return;
    }

    const newNode: Object = {
      kind: ApiJsonFile.convertKindToJson(astProperty.kind),
      isOptional: !!astProperty.isOptional,
      isReadOnly: !!astProperty.isReadOnly,
      isStatic: !!astProperty.isStatic,
      type: astProperty.type,
      deprecatedMessage: astProperty.documentation.deprecatedMessage || [],
      summary: astProperty.documentation.summary || [],
      remarks: astProperty.documentation.remarks || [],
      isBeta: astProperty.documentation.releaseTag === ReleaseTag.Beta
    };

    refObject[astProperty.name] = newNode;
  }

  protected visitAstModuleVariable(astModuleVariable: AstModuleVariable, refObject?: Object): void {
    const newNode: Object = {
      kind: ApiJsonFile.convertKindToJson(astModuleVariable.kind),
      type: astModuleVariable.type,
      value: astModuleVariable.value,
      deprecatedMessage: astModuleVariable.documentation.deprecatedMessage || [],
      summary: astModuleVariable.documentation.summary || [],
      remarks: astModuleVariable.documentation.remarks || [],
      isBeta: astModuleVariable.documentation.releaseTag === ReleaseTag.Beta
    };

    refObject[astModuleVariable.name] = newNode;
  }

  protected visitAstMethod(astMethod: AstMethod, refObject?: Object): void {
    if (!astMethod.supportedName) {
      return;
    }

    for (const param of astMethod.params) {
      this.visitApiParam(param, astMethod.documentation.parameters[param.name]);
    }

    let newNode: Object;
    if (astMethod.name === '__constructor') {
      newNode = {
        kind: ApiJsonFile.convertKindToJson(AstItemKind.Constructor),
        signature: astMethod.getDeclarationLine(),
        parameters: astMethod.documentation.parameters,
        deprecatedMessage: astMethod.documentation.deprecatedMessage || [],
        summary: astMethod.documentation.summary || [],
        remarks: astMethod.documentation.remarks || []
      };
    } else {
      const returnValueNode: IApiReturnValue = {
        type: astMethod.returnType,
        description: astMethod.documentation.returnsMessage
      };

      newNode = {
        kind: ApiJsonFile.convertKindToJson(astMethod.kind),
        signature: astMethod.getDeclarationLine(),
        accessModifier: astMethod.accessModifier ? ApiAccessModifier[astMethod.accessModifier].toLowerCase() : '',
        isOptional: !!astMethod.isOptional,
        isStatic: !!astMethod.isStatic,
        returnValue: returnValueNode,
        parameters: astMethod.documentation.parameters,
        deprecatedMessage: astMethod.documentation.deprecatedMessage || [],
        summary: astMethod.documentation.summary || [],
        remarks: astMethod.documentation.remarks || [],
        isBeta: astMethod.documentation.releaseTag === ReleaseTag.Beta
      };
    }

    refObject[astMethod.name] = newNode;
  }

  protected visitApiParam(astParam: AstParameter, refObject?: Object): void {
    if (!astParam.supportedName) {
      return;
    }

    if (refObject) {
      (refObject as IApiParameter).isOptional = astParam.isOptional;
      (refObject as IApiParameter).isSpread = astParam.isSpread;
      (refObject as IApiParameter).type = astParam.type;
    }
  }
}
