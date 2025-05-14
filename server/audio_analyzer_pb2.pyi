from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class AnalyzeAudioRequest(_message.Message):
    __slots__ = ("minio_bucket_name", "minio_object_key")
    MINIO_BUCKET_NAME_FIELD_NUMBER: _ClassVar[int]
    MINIO_OBJECT_KEY_FIELD_NUMBER: _ClassVar[int]
    minio_bucket_name: str
    minio_object_key: str
    def __init__(self, minio_bucket_name: _Optional[str] = ..., minio_object_key: _Optional[str] = ...) -> None: ...

class AudioChunkPrediction(_message.Message):
    __slots__ = ("chunk_id", "score", "start_time_seconds", "end_time_seconds")
    CHUNK_ID_FIELD_NUMBER: _ClassVar[int]
    SCORE_FIELD_NUMBER: _ClassVar[int]
    START_TIME_SECONDS_FIELD_NUMBER: _ClassVar[int]
    END_TIME_SECONDS_FIELD_NUMBER: _ClassVar[int]
    chunk_id: str
    score: float
    start_time_seconds: float
    end_time_seconds: float
    def __init__(self, chunk_id: _Optional[str] = ..., score: _Optional[float] = ..., start_time_seconds: _Optional[float] = ..., end_time_seconds: _Optional[float] = ...) -> None: ...

class AnalyzeAudioResponse(_message.Message):
    __slots__ = ("predictions", "error_message")
    PREDICTIONS_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    predictions: _containers.RepeatedCompositeFieldContainer[AudioChunkPrediction]
    error_message: str
    def __init__(self, predictions: _Optional[_Iterable[_Union[AudioChunkPrediction, _Mapping]]] = ..., error_message: _Optional[str] = ...) -> None: ...
