// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { IDocElement } from '../markupItem/OldMarkupItem';

/**
 * Whether the function is public, private, or protected.
 * @alpha
 */
export type ApiAccessModifier = 'public' | 'private' | 'protected' | '';

/**
 * The enum value of an IApiEnum.
 *
 * IApiEnumMember does not extend the IDocITem base class
 * because the summary is not required.
 * @alpha
 */
export interface IApiEnumMember {
  value: string;
  summary?: IDocElement[];
  remarks?: IDocElement[];
  deprecatedMessage?: IDocElement[];
}

/**
 * Parameter Doc item.
 * @alpha
 */
export interface IApiParameter {
  /**
   * the parameter name
   */
  name: string;

  /**
   * describes the parameter
   */
  description: IDocElement[];

  /**
   * Whether the parameter is optional
   */
  isOptional: boolean;

  /**
   * Whether the parameter has the '...' spread suffix
   */
  isSpread: boolean;

  /**
   * The data type of the parameter
   */
  type: string;
}

/**
 * Return value of a method or function.
 * @alpha
 */
export interface IApiReturnValue {
  /**
   * The data type returned by the function
   */
  type: string;

  /**
   * Describes the return value
   */
  description: IDocElement[];
}

/**
 * DocItems are the typescript adaption of the json schemas
 * defined in API-json-schema.json. IDocElement is a component
 * for IDocItems because they represent formated rich text.
 *
 * This is the base class for other DocItem types.
 * @alpha
 */
export interface IApiBaseDefinition {
  /**
   * kind of DocItem. Ex: 'class', 'Enum', 'Function', etc.
   */
  kind: string;
  isBeta: boolean;
  summary: IDocElement[];
  remarks?: IDocElement[];
  deprecatedMessage?: IDocElement[];
}

/**
 * A property of a TypeScript class or interface
 * @alpha
 */
export interface IApiProperty extends IApiBaseDefinition {

  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'property';
  /**
   * For an interface member, whether it is optional
   */
  isOptional: boolean;

  /**
   * Whether the property is read-only
   */
  isReadOnly: boolean;

  /**
   * For a class member, whether it is static
   */
  isStatic: boolean;

  /**
   * The data type of this property
   */
  type: string;
}

/**
 * A member function of a typescript class or interface.
 * @alpha
 */
export interface IApiMethod extends IApiBaseDefinition {
  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'method';
  /**
   * a text summary of the method definition
   */
  signature: string;

  /**
   * the access modifier of the method
   */
  accessModifier: ApiAccessModifier;

  /**
   * for an interface member, whether it is optional
   */
  isOptional: boolean;

  /**
   * for a class member, whether it is static
   */
  isStatic: boolean;

  /**
   * a mapping of parameter name to IApiParameter
   */

  parameters: { [name: string]: IApiParameter};

  /**
   * describes the return value of the method
   */
  returnValue: IApiReturnValue;
}

/**
 * A Typescript function.
 * @alpha
 */
export interface IApiFunction extends IApiBaseDefinition {
  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'function';
  /**
   * parameters of the function
   */
  parameters: { [name: string]: IApiParameter};

  /**
   * a description of the return value
   */
  returnValue: IApiReturnValue;
}

/**
 * IApiClass represetns an exported class.
 * @alpha
 */
export interface IApiClass extends IApiBaseDefinition {
  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'class';
  /**
   * Can be a combination of methods and/or properties
   */
  members: { [name: string]: ApiMember};

  /**
   * Interfaces implemented by this class
   */
  implements?: string;

  /**
   * The base class for this class
   */
  extends?: string;

  /**
   * Generic type parameters for this class
   */
  typeParameters?: string[];
}

/**
 * IApiEnum represents an exported enum.
 * @alpha
 */
export interface IApiEnum extends IApiBaseDefinition {
  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'enum';

  values: IApiEnumMember[];
}

/**
 * IApiInterface represents an exported interface.
 * @alpha
 */
export interface IApiInterface extends IApiBaseDefinition {
  /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'interface';
  /**
   * A mapping from the name of a member API to its ApiMember
   */
  members: { [name: string]: ApiMember};

  /**
   * Interfaces implemented by this interface
   */
  implements?: string;

  /**
   * The base interface for this interface
   */
  extends?: string;

  /**
   * Generic type parameters for this interface
   */
  typeParameters?: string[];
}

/**
 * IApiPackage is an object contaning the exported
 * definions of this API package. The exports can include:
 * classes, interfaces, enums, functions.
 * @alpha
 */
export interface IApiPackage {
   /**
   * {@inheritdoc IApiBaseDefinition.kind}
   */
  kind: 'package';

  /**
   * IDocItems of exported API items
   */
  exports: { [name: string]: ApiItem};

  /**
   * The following are needed so that this interface and can share
   * common properties with others that extend IApiBaseDefinition. The IApiPackage
   * does not extend the IApiBaseDefinition because a summary is not required for
   * a package.
   */
  isBeta?: boolean;
  summary?: IDocElement[];
  remarks?: IDocElement[];
  deprecatedMessage?: IDocElement[];
}

/**
 * A member of a class.
 * @alpha
 */
export type ApiMember = IApiProperty | IApiMethod;

/**
 * @alpha
 */
export type ApiItem = IApiProperty | ApiMember | IApiFunction |
   IApiClass |IApiEnum | IApiInterface | IApiPackage;

/**
 * Describes a return type and description of the return type
 * that is given in documentation comments.
 *
 * @alpha
 */
export interface IApiReturnValue {
  type: string;
  description: IDocElement[];
}
