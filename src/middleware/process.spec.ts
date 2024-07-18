import 'mocha';
import { assert } from 'chai';
import sinon from 'sinon';
import { WebClient } from '@slack/web-api';
import { createFakeLogger } from '../test-helpers';
import {
  AllMiddlewareArgs,
  AnyMiddlewareArgs,
  Middleware,
} from '../types';
import processMiddleware from './process';
import { CodedError } from '../errors';

describe('Middleware processing', () => {
  describe('processMiddleware()', () => {
    it('should still call the last function when no middleware is provided', async () => {
      const { initialArgs, context, client, logger } = setupMockArguments();
      const middleware: Middleware<AnyMiddlewareArgs>[] = [];
      const last = sinon.spy();
      assert(last.notCalled);
      await processMiddleware(middleware, initialArgs, context, client, logger, last);
      assert(last.calledOnce);
    });

    it('should run through the middleware chain when using the included next()', async () => {
      const { initialArgs, context, client, logger } = setupMockArguments();
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();
      const fn1 = async (args: AllMiddlewareArgs) => {
        callback1();
        await args.next();
      };
      const fn2 = async (args: AllMiddlewareArgs) => {
        callback2();
        await args.next();
      };
      const middleware: Middleware<AnyMiddlewareArgs>[] = [fn1, fn2, fn2];
      const last = sinon.spy();
      assert(callback1.notCalled);
      assert(callback2.notCalled);
      assert(last.notCalled);
      await processMiddleware(middleware, initialArgs, context, client, logger, last);
      assert(callback1.calledOnce);
      assert(callback1.calledBefore(callback2));
      assert(callback2.calledTwice);
      assert(callback2.calledBefore(last));
      assert(last.calledOnce);
    });

    it('should call the next middleware only if next() is called', async () => {
      const { initialArgs, context, client, logger } = setupMockArguments();
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();
      const fn1 = async (_args: AllMiddlewareArgs) => {
        callback1();
      };
      const fn2 = async (_args: AllMiddlewareArgs) => {
        callback2();
      };
      const middleware: Middleware<AnyMiddlewareArgs>[] = [fn1, fn2];
      const last = sinon.spy();
      assert(callback1.notCalled);
      assert(callback2.notCalled);
      assert(last.notCalled);
      await processMiddleware(middleware, initialArgs, context, client, logger, last);
      assert(callback1.calledOnce);
      assert(callback2.notCalled);
      assert(last.notCalled);
    });

    it('should call the next middleware as soon as next() is called', async () => {
      const { initialArgs, context, client, logger } = setupMockArguments();
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();
      const callback3 = sinon.spy();
      const fn1 = async (args: AllMiddlewareArgs) => {
        callback1();
        await args.next();
        callback3();
      };
      const fn2 = async (args: AllMiddlewareArgs) => {
        await callback2();
        args.next();
      };
      const middleware: Middleware<AnyMiddlewareArgs>[] = [fn1, fn2];
      const last = sinon.spy();
      assert(callback1.notCalled);
      assert(callback2.notCalled);
      assert(callback3.notCalled);
      assert(last.notCalled);
      await processMiddleware(middleware, initialArgs, context, client, logger, last);
      assert(callback1.calledOnce);
      assert(callback2.calledOnce);
      assert(callback2.calledBefore(callback3));
      assert(callback3.calledOnce);
      assert(last.calledOnce);
    });

    it('errors if next is called more than once', async () => {
      const { initialArgs, context, client, logger } = setupMockArguments();
      const callback1 = sinon.spy();
      const callback2 = sinon.spy();
      const fn1 = async (args: AllMiddlewareArgs) => {
        await args.next();
        callback1();
        await args.next();
        callback2();
      };
      const middleware: Middleware<AnyMiddlewareArgs>[] = [fn1];
      const last = sinon.spy();
      assert(last.notCalled);
      assert(callback1.notCalled);
      assert(callback2.notCalled);
      try {
        await processMiddleware(middleware, initialArgs, context, client, logger, last);
        assert(callback2.notCalled);
      } catch (err) {
        assert(callback1.called);
        assert(callback2.notCalled);
        assert(last.called);
        assert.equal((err as CodedError).code, 'slack_bolt_middleware_next_error');
      }
    });
  });
});

/**
 * Make mocks of required variables without specifying much detail.
 * @returns object containing arguments for processMiddleware().
 */
function setupMockArguments() {
  const initialArgs: AnyMiddlewareArgs = {} as AnyMiddlewareArgs;
  const context = { isEnterpriseInstall: true };
  const client = new WebClient();
  const logger = createFakeLogger();
  return { initialArgs, context, client, logger };
}
