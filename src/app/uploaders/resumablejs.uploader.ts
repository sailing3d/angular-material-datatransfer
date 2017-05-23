import { Injectable } from '@angular/core';
import * as _ from 'underscore';
import * as Resumable from 'resumablejs';

import { BaseUploader } from './base.uploader';
import { LoggerService } from '../services';
import { IDatatransferItem, DatatransferItem, SizeInformation } from '../models';
import { TransferType, TransferStatus, DecimalByteUnit } from '../enums';

@Injectable()
export class ResumableJsUploader extends BaseUploader {

    private r = undefined;

    constructor(protected logger: LoggerService) {
        super(logger);
        this.initResumable();
    }

    private initResumable(): void {
        this.r = new Resumable({
            target: '/echo/json/',
            query: {},
            maxChunkRetries: 2,
            maxFiles: 10,
            prioritizeFirstAndLastChunk: true,
            simultaneousUploads: 2,
            chunkSize: 1 * 1024 * 1024
        });

        this.r.on('fileAdded', function (file, event) {
            let newItem = new DatatransferItem({
                id: file.uniqueIdentifier,
                name: file.fileName,
                path: file.relativePath.substr(0, file.relativePath.length - file.fileName.length),
                sizeInformation: new SizeInformation({decimalByteUnit: DecimalByteUnit.Byte, decimalByteUnitSize: file.size}),
                transferType: TransferType.Upload,
                status: TransferStatus.Queued,
                progress: 0,
                externalItem: file
            });

            // this.logger.log(newItem);
            this.addItem(newItem);
        }.bind(this));
        this.r.on('fileProgress', function (file, message) {
            // this.logger.log('fileProgress', file.progress());
            this.updateItemProgress(file.uniqueIdentifier, file.progress());
            this.updateOverallProgress(this.r.progress());
        }.bind(this));
        this.r.on('fileSuccess', function (file, message) {
            // this.logger.log('fileSuccess', file);
            this.changeItemStatus(file.uniqueIdentifier, TransferStatus.Finished);
        }.bind(this));
        this.r.on('fileError', function (file, message) {
            this.logger.log('fileError', file, message);
        }.bind(this));
        this.r.on('uploadStart', function () {
            this.updateOverallProgress(this.r.progress());
            this.updateOverallSize(new SizeInformation({decimalByteUnit: DecimalByteUnit.Byte, decimalByteUnitSize: this.r.getSize()}));
        }.bind(this));
        this.r.on('chunkingComplete', function () {
            // this.logger.log('chunkingComplete');
        }.bind(this));
        this.r.on('complete', function () {
            this.logger.log('complete');
        }.bind(this));
    }

    public assignBrowse(element): void {
        super.assignBrowse(element);
        this.r.assignBrowse(element);
    }

    public assignDrop(element): void {
        super.assignDrop(element);
        this.r.assignDrop(element);
    }

    public startAll(): void {
        super.startAll();
        this.r.upload();
    }

    public removeAll(): void {
        let tempFiles = this.r.files.slice();
        _.each(tempFiles, function (file) {
            this.r.removeFile(file);
        }.bind(this));
        super.removeAll();
    }

    public retryItem(item: IDatatransferItem): void {
        super.retryItem(item);
        item.externalItem.retry();
    }
}